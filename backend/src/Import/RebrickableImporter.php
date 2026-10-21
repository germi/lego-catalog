<?php

declare(strict_types=1);

namespace App\Import;

use App\Entity\Color;
use App\Entity\Taxonomy;
use App\Enum\ElementCodeSource;
use App\Enum\InventoryRole;
use App\Enum\PartMaterial;
use App\Enum\PartNumberSource;
use App\Enum\PartRelationType;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Loads the Rebrickable CSV dumps into the catalogue.
 *
 * Written against DBAL rather than the ORM on purpose. The element and inventory files
 * run to millions of rows; hydrating an entity per row would be both slow and a memory
 * leak waiting to happen. The small lookup tables are read through the ORM, where the
 * row count is in the hundreds and clarity is worth more than speed.
 *
 * Every write is an upsert keyed on a natural unique constraint, so a re-import updates
 * in place rather than duplicating, and a run that dies halfway can simply be repeated.
 * Nothing here deletes: a part that disappears from the dump stays in the catalogue,
 * because it did not stop existing in the real world.
 */
final class RebrickableImporter
{
    /** Rows per INSERT. Keeps the statement well under the placeholder limit. */
    private const BATCH = 500;

    /** Rows of a huge file held in memory at once before resolving their ids. */
    private const CHUNK = 20000;

    /** Rebrickable's part_material values to ours. */
    private const MATERIALS = [
        'plastic' => PartMaterial::Plastic,
        'rubber' => PartMaterial::Rubber,
        'cloth' => PartMaterial::Cloth,
        'metal' => PartMaterial::Metal,
        'foam' => PartMaterial::Foam,
        'flexible plastic' => PartMaterial::FlexiblePlastic,
        'cardboard/paper' => PartMaterial::Cardboard,
        'cardboard' => PartMaterial::Cardboard,
        'paper' => PartMaterial::Cardboard,
    ];

    /** Rebrickable's one-letter rel_type codes: (P)rint, Pai(R), Su(B)-Part, (M)old, Pa(T)tern, (A)lternate. */
    private const RELATION_TYPES = [
        'P' => PartRelationType::Print,
        'R' => PartRelationType::Pair,
        'B' => PartRelationType::SubPart,
        'M' => PartRelationType::MouldVariant,
        'T' => PartRelationType::Pattern,
        'A' => PartRelationType::Alternate,
    ];

    /** @var array<string, int> part number => id */
    private array $partIds = [];

    /** @var array<int, int> rebrickable colour id => colour id */
    private array $colorIds = [];

    /** @var array<string, int> set number => id */
    private array $setIds = [];

    /** @var array<string, int> minifig number => id */
    private array $minifigIds = [];

    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $em,
        private readonly RebrickableDownloader $downloader,
        private readonly CsvReader $csv,
        private readonly \App\Taxonomy\ColorClassifier $classifier,
    ) {
    }

    /**
     * @param list<string>              $stages   stage names to run, in the order given
     * @param callable(string, ?int):void $progress called as the import moves on
     *
     * @return array<string, array<string, int>> per-stage row counts
     */
    public function import(array $stages, callable $progress, int $maxAge = 86400, bool $force = false): array
    {
        $counts = [];
        foreach ($stages as $stage) {
            $progress($stage, null);
            $counts[$stage] = match ($stage) {
                'colors' => $this->importColors($maxAge, $force),
                'part_categories' => $this->importPartCategories($maxAge, $force),
                'parts' => $this->importParts($maxAge, $force, $progress),
                'part_relationships' => $this->importPartRelationships($maxAge, $force),
                'elements' => $this->importElements($maxAge, $force, $progress),
                'themes' => $this->importThemes($maxAge, $force),
                'sets' => $this->importSets($maxAge, $force, $progress),
                'minifigs' => $this->importMinifigs($maxAge, $force, $progress),
                'inventories' => $this->importInventories($maxAge, $force, $progress),
                default => throw new \InvalidArgumentException(\sprintf('Unknown stage "%s".', $stage)),
            };
        }

        return $counts;
    }

    /** The stages, in the order their foreign keys require. */
    public static function stages(): array
    {
        return [
            'colors', 'part_categories', 'parts', 'part_relationships',
            'elements', 'themes', 'sets', 'minifigs', 'inventories',
        ];
    }

    // --- Stages ------------------------------------------------------------

    /** @return array<string, int> */
    private function importColors(int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('colors', $maxAge, $force);
        $families = $this->map('SELECT slug, id FROM color_family');
        $taken = $this->map('SELECT slug, id FROM color');
        $rows = [];
        $seen = 0;

        foreach ($this->csv->rows($path, ['id', 'name', 'rgb', 'is_trans']) as $row) {
            ++$seen;
            $name = $row['name'];
            $rebrickableId = (int) $row['id'];
            $isTrans = self::truthy($row['is_trans']);

            // Rebrickable's "[No Color/Any Color]" is our not-applicable sentinel;
            // claim that row rather than making a second one that means the same thing.
            if (str_contains(strtolower($name), 'no color')) {
                $this->connection->executeStatement(
                    'UPDATE color SET rebrickable_id = ? WHERE slug = ? AND rebrickable_id IS NULL',
                    [$rebrickableId, Color::NOT_APPLICABLE],
                );
                continue;
            }

            $slug = $this->uniqueSlug($name, $taken, (string) $rebrickableId);
            $familySlug = $this->classifier->familySlugFor($name);
            $hex = '' === $row['rgb'] ? null : '#'.ltrim($row['rgb'], '#');

            $rows[] = [
                $name,
                $slug,
                $hex,
                $this->classifier->finishFor($name, $isTrans)->value,
                $familySlug === null ? null : ($families[$familySlug] ?? null),
                $rebrickableId,
            ];
        }

        $written = $this->upsert(
            'color',
            ['name', 'slug', 'hex', 'finish', 'family_id', 'rebrickable_id'],
            $rows,
            // Name and family can be corrected by hand; a re-import must not undo that.
            ['hex', 'finish'],
            'rebrickable_id',
        );

        return ['read' => $seen, 'written' => $written];
    }

    /** @return array<string, int> */
    private function importPartCategories(int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('part_categories', $maxAge, $force);
        $taxonomyId = $this->rebrickableTaxonomyId();
        $taken = $this->map('SELECT slug, id FROM part_category WHERE taxonomy_id = '.$taxonomyId);
        $rows = [];
        $seen = 0;

        // Rebrickable's categories are a flat list, so every node is a root here. The
        // hierarchy the project wants lives in the BrickLink and Brick Architect trees.
        foreach ($this->csv->rows($path, ['id', 'name']) as $row) {
            ++$seen;
            $slug = $this->uniqueSlug($row['name'], $taken, $row['id']);
            $rows[] = [$taxonomyId, $row['name'], $slug, $slug, 0, $row['id'], (int) $row['id']];
        }

        $written = $this->upsert(
            'part_category',
            ['taxonomy_id', 'name', 'slug', 'path', 'depth', 'external_code', 'sort_order'],
            $rows,
            ['name', 'path', 'depth'],
            'taxonomy_id, slug',
        );

        return ['read' => $seen, 'written' => $written];
    }

    /** @return array<string, int> */
    private function importParts(int $maxAge, bool $force, callable $progress): array
    {
        $path = $this->downloader->fetch('parts', $maxAge, $force);
        $taxonomyId = $this->rebrickableTaxonomyId();
        $categoryIds = $this->map(
            'SELECT external_code, id FROM part_category WHERE taxonomy_id = '.$taxonomyId.' AND external_code IS NOT NULL'
        );
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d H:i:s');

        $rows = [];
        $seen = 0;
        $written = 0;
        $categoryOf = [];

        foreach ($this->csv->rows($path, ['part_num', 'name', 'part_cat_id', 'part_material']) as $row) {
            ++$seen;
            $material = self::MATERIALS[strtolower($row['part_material'])] ?? PartMaterial::Other;
            $rows[] = [
                $row['part_num'],
                mb_substr($row['name'], 0, 255),
                $material->value,
                $row['part_num'],
                $now,
            ];
            if (isset($categoryIds[$row['part_cat_id']])) {
                $categoryOf[$row['part_num']] = $categoryIds[$row['part_cat_id']];
            }

            if (\count($rows) >= self::CHUNK) {
                $written += $this->upsert('part', ['number', 'name', 'material', 'rebrickable_id', 'created_at'], $rows, ['name', 'material'], 'number');
                $rows = [];
                $progress('parts', $seen);
            }
        }
        $written += $this->upsert('part', ['number', 'name', 'material', 'rebrickable_id', 'created_at'], $rows, ['name', 'material'], 'number');

        // Now that every part has an id, file them in the Rebrickable taxonomy and
        // point primary_category_id at the same row, since that taxonomy is the default.
        $this->loadPartIds();
        $assignments = [];
        $primary = [];
        foreach ($categoryOf as $partNumber => $categoryId) {
            $partId = $this->partIds[$partNumber] ?? null;
            if (null === $partId) {
                continue;
            }
            $assignments[] = [$partId, $categoryId, $taxonomyId];
            $primary[$categoryId][] = $partId;
        }
        $this->upsert('part_category_assignment', ['part_id', 'category_id', 'taxonomy_id'], $assignments, ['category_id'], 'part_id, taxonomy_id');

        foreach ($primary as $categoryId => $partIds) {
            foreach (array_chunk($partIds, 1000) as $batch) {
                $this->connection->executeStatement(
                    'UPDATE part SET primary_category_id = ? WHERE id IN ('.implode(',', array_fill(0, \count($batch), '?')).')',
                    array_merge([$categoryId], $batch),
                );
            }
        }

        return ['read' => $seen, 'written' => $written, 'filed' => \count($assignments)];
    }

    /** @return array<string, int> */
    private function importPartRelationships(int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('part_relationships', $maxAge, $force);
        $this->loadPartIds();
        $rows = [];
        $decorated = [];
        $seen = 0;
        $skipped = 0;

        foreach ($this->csv->rows($path, ['rel_type', 'child_part_num', 'parent_part_num']) as $row) {
            ++$seen;
            $type = self::RELATION_TYPES[strtoupper(trim($row['rel_type']))] ?? null;
            $parentId = $this->partIds[$row['parent_part_num']] ?? null;
            $childId = $this->partIds[$row['child_part_num']] ?? null;
            if (null === $type || null === $parentId || null === $childId || $parentId === $childId) {
                ++$skipped;
                continue;
            }

            $rows[] = [$parentId, $childId, $type->value];
            // A printed or patterned child is by definition a decorated part.
            if (PartRelationType::Print === $type || PartRelationType::Pattern === $type) {
                $decorated[$childId] = true;
            }
        }

        $written = $this->upsert(
            'part_relationship',
            ['parent_part_id', 'child_part_id', 'type'],
            $rows,
            ['type'],
            'parent_part_id, child_part_id, type',
        );

        foreach (array_chunk(array_keys($decorated), 1000) as $batch) {
            $this->connection->executeStatement(
                'UPDATE part SET is_decorated = 1 WHERE id IN ('.implode(',', array_fill(0, \count($batch), '?')).')',
                $batch,
            );
        }

        return ['read' => $seen, 'written' => $written, 'skipped' => $skipped, 'decorated' => \count($decorated)];
    }

    /** @return array<string, int> */
    private function importElements(int $maxAge, bool $force, callable $progress): array
    {
        $path = $this->downloader->fetch('elements', $maxAge, $force);
        $this->loadPartIds();
        $this->loadColorIds();

        $seen = 0;
        $elements = 0;
        $codes = 0;
        $skipped = 0;
        $chunk = [];

        foreach ($this->csv->rows($path, ['element_id', 'part_num', 'color_id']) as $row) {
            ++$seen;
            $partId = $this->partIds[$row['part_num']] ?? null;
            $colorId = $this->colorIds[(int) $row['color_id']] ?? null;
            if (null === $partId || null === $colorId) {
                ++$skipped;
                continue;
            }

            $chunk[] = [$partId, $colorId, $row['element_id']];
            if (\count($chunk) >= self::CHUNK) {
                [$e, $c] = $this->flushElementChunk($chunk);
                $elements += $e;
                $codes += $c;
                $chunk = [];
                $progress('elements', $seen);
            }
        }
        [$e, $c] = $this->flushElementChunk($chunk);

        return ['read' => $seen, 'elements' => $elements + $e, 'codes' => $codes + $c, 'skipped' => $skipped];
    }

    /** @return array<string, int> */
    private function importThemes(int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('themes', $maxAge, $force);
        $taken = $this->map('SELECT slug, id FROM theme');
        $rows = [];
        $parentOf = [];
        $seen = 0;

        foreach ($this->csv->rows($path, ['id', 'name', 'parent_id']) as $row) {
            ++$seen;
            $slug = $this->uniqueSlug($row['name'], $taken, $row['id']);
            $rows[] = [$row['name'], $slug, '', 0, (int) $row['id']];
            if ('' !== $row['parent_id']) {
                $parentOf[(int) $row['id']] = (int) $row['parent_id'];
            }
        }

        $written = $this->upsert('theme', ['name', 'slug', 'path', 'depth', 'rebrickable_id'], $rows, ['name'], 'rebrickable_id');

        // Second pass for the parents: a theme's parent may appear after it in the file.
        $byRebrickableId = $this->map('SELECT rebrickable_id, id FROM theme WHERE rebrickable_id IS NOT NULL');
        foreach ($parentOf as $childRb => $parentRb) {
            if (isset($byRebrickableId[$childRb], $byRebrickableId[$parentRb])) {
                $this->connection->executeStatement(
                    'UPDATE theme SET parent_id = ? WHERE id = ?',
                    [$byRebrickableId[$parentRb], $byRebrickableId[$childRb]],
                );
            }
        }

        return ['read' => $seen, 'written' => $written, 'parented' => \count($parentOf)];
    }

    /** @return array<string, int> */
    private function importSets(int $maxAge, bool $force, callable $progress): array
    {
        $path = $this->downloader->fetch('sets', $maxAge, $force);
        $themeIds = $this->map('SELECT rebrickable_id, id FROM theme WHERE rebrickable_id IS NOT NULL');
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d H:i:s');
        $rows = [];
        $seen = 0;
        $written = 0;

        foreach ($this->csv->rows($path, ['set_num', 'name', 'year', 'theme_id', 'num_parts']) as $row) {
            ++$seen;
            [$base, $variant] = \App\Entity\Set::splitNumber($row['set_num']);
            $rows[] = [
                $row['set_num'],
                $base,
                $variant,
                mb_substr($row['name'], 0, 255),
                '' === $row['year'] ? null : (int) $row['year'],
                $themeIds[(int) $row['theme_id']] ?? null,
                (int) $row['num_parts'],
                $row['img_url'] ?? null,
                $row['set_num'],
                $now,
            ];

            if (\count($rows) >= self::CHUNK) {
                $written += $this->flushSets($rows);
                $rows = [];
                $progress('sets', $seen);
            }
        }
        $written += $this->flushSets($rows);

        return ['read' => $seen, 'written' => $written];
    }

    /** @return array<string, int> */
    private function importMinifigs(int $maxAge, bool $force, callable $progress): array
    {
        $path = $this->downloader->fetch('minifigs', $maxAge, $force);
        $rows = [];
        $seen = 0;
        $written = 0;

        foreach ($this->csv->rows($path, ['fig_num', 'name', 'num_parts']) as $row) {
            ++$seen;
            $rows[] = [
                $row['fig_num'],
                mb_substr($row['name'], 0, 255),
                (int) $row['num_parts'],
                $row['img_url'] ?? null,
                $row['fig_num'],
            ];

            if (\count($rows) >= self::CHUNK) {
                $written += $this->upsert('minifig', ['number', 'name', 'num_parts', 'image_url', 'rebrickable_id'], $rows, ['name', 'num_parts', 'image_url'], 'number');
                $rows = [];
                $progress('minifigs', $seen);
            }
        }
        $written += $this->upsert('minifig', ['number', 'name', 'num_parts', 'image_url', 'rebrickable_id'], $rows, ['name', 'num_parts', 'image_url'], 'number');

        return ['read' => $seen, 'written' => $written];
    }

    /**
     * The inventory files, which only make sense together.
     *
     * Rebrickable versions its inventories and keeps minifigure part lists in the same
     * table as set ones, told apart only by whether the number names a set or a figure.
     * We keep the highest version of each and record which that was on the set.
     *
     * @return array<string, int>
     */
    private function importInventories(int $maxAge, bool $force, callable $progress): array
    {
        $inventoriesPath = $this->downloader->fetch('inventories', $maxAge, $force);
        $this->loadSetIds();
        $this->loadMinifigIds();

        /** @var array<int, array{string, int}> inventory id => [owner number, version] */
        $setInventories = [];
        $minifigInventories = [];
        $best = [];

        foreach ($this->csv->rows($inventoriesPath, ['id', 'version', 'set_num']) as $row) {
            $owner = $row['set_num'];
            $version = (int) $row['version'];
            if (($best[$owner] ?? 0) >= $version) {
                continue;
            }
            $best[$owner] = $version;
        }

        foreach ($this->csv->rows($inventoriesPath, ['id', 'version', 'set_num']) as $row) {
            $owner = $row['set_num'];
            $version = (int) $row['version'];
            if (($best[$owner] ?? 0) !== $version) {
                continue;
            }
            if (isset($this->setIds[$owner])) {
                $setInventories[(int) $row['id']] = [$owner, $version];
            } elseif (isset($this->minifigIds[$owner])) {
                $minifigInventories[(int) $row['id']] = [$owner, $version];
            }
        }

        foreach (array_chunk($setInventories, 1, true) as $id => $_) {
            break; // no-op; the versions are written below in batches
        }
        foreach (array_chunk(array_keys($setInventories), 500) as $batch) {
            foreach ($batch as $inventoryId) {
                [$owner, $version] = $setInventories[$inventoryId];
                $this->connection->executeStatement(
                    'UPDATE `sets` SET inventory_version = ? WHERE id = ?',
                    [$version, $this->setIds[$owner]],
                );
            }
        }

        $counts = ['set inventories' => \count($setInventories), 'minifig inventories' => \count($minifigInventories)];
        $counts += $this->importInventoryParts($setInventories, $minifigInventories, $maxAge, $force, $progress);
        $counts += $this->importInventorySets($setInventories, $maxAge, $force);
        $counts += $this->importInventoryMinifigs($setInventories, $maxAge, $force);

        return $counts;
    }

    /**
     * @param array<int, array{string, int}> $setInventories
     * @param array<int, array{string, int}> $minifigInventories
     *
     * @return array<string, int>
     */
    private function importInventoryParts(array $setInventories, array $minifigInventories, int $maxAge, bool $force, callable $progress): array
    {
        $path = $this->downloader->fetch('inventory_parts', $maxAge, $force);
        $this->loadPartIds();
        $this->loadColorIds();

        $seen = 0;
        $setLines = 0;
        $minifigLines = 0;
        $skipped = 0;
        $chunk = [];

        foreach ($this->csv->rows($path, ['inventory_id', 'part_num', 'color_id', 'quantity', 'is_spare']) as $row) {
            ++$seen;
            $inventoryId = (int) $row['inventory_id'];
            $isSet = isset($setInventories[$inventoryId]);
            $isMinifig = isset($minifigInventories[$inventoryId]);
            $partId = $this->partIds[$row['part_num']] ?? null;
            $colorId = $this->colorIds[(int) $row['color_id']] ?? null;

            if ((!$isSet && !$isMinifig) || null === $partId || null === $colorId) {
                ++$skipped;
                continue;
            }

            $chunk[] = [
                $partId,
                $colorId,
                $isSet ? 'set' : 'minifig',
                $isSet ? $this->setIds[$setInventories[$inventoryId][0]] : $this->minifigIds[$minifigInventories[$inventoryId][0]],
                max(1, (int) $row['quantity']),
                self::truthy($row['is_spare']) ? InventoryRole::Spare->value : InventoryRole::Regular->value,
            ];

            if (\count($chunk) >= self::CHUNK) {
                [$s, $m] = $this->flushInventoryPartChunk($chunk);
                $setLines += $s;
                $minifigLines += $m;
                $chunk = [];
                $progress('inventory_parts', $seen);
            }
        }
        [$s, $m] = $this->flushInventoryPartChunk($chunk);

        return [
            'inventory part rows read' => $seen,
            'set lines' => $setLines + $s,
            'minifig lines' => $minifigLines + $m,
            'inventory parts skipped' => $skipped,
        ];
    }

    /**
     * @param array<int, array{string, int}> $setInventories
     *
     * @return array<string, int>
     */
    private function importInventorySets(array $setInventories, int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('inventory_sets', $maxAge, $force);
        $rows = [];

        foreach ($this->csv->rows($path, ['inventory_id', 'set_num', 'quantity']) as $row) {
            $inventoryId = (int) $row['inventory_id'];
            $parent = $setInventories[$inventoryId][0] ?? null;
            $childId = $this->setIds[$row['set_num']] ?? null;
            if (null === $parent || null === $childId || $this->setIds[$parent] === $childId) {
                continue;
            }
            $rows[] = [$this->setIds[$parent], $childId, max(1, (int) $row['quantity'])];
        }

        return ['subset lines' => $this->upsert('set_subset', ['set_id', 'child_set_id', 'quantity'], $rows, ['quantity'], 'set_id, child_set_id')];
    }

    /**
     * @param array<int, array{string, int}> $setInventories
     *
     * @return array<string, int>
     */
    private function importInventoryMinifigs(array $setInventories, int $maxAge, bool $force): array
    {
        $path = $this->downloader->fetch('inventory_minifigs', $maxAge, $force);
        $this->loadMinifigIds();
        $rows = [];

        foreach ($this->csv->rows($path, ['inventory_id', 'fig_num', 'quantity']) as $row) {
            $inventoryId = (int) $row['inventory_id'];
            $parent = $setInventories[$inventoryId][0] ?? null;
            $minifigId = $this->minifigIds[$row['fig_num']] ?? null;
            if (null === $parent || null === $minifigId) {
                continue;
            }
            $rows[] = [$this->setIds[$parent], $minifigId, max(1, (int) $row['quantity']), InventoryRole::Regular->value];
        }

        return ['set minifig lines' => $this->upsert('set_minifig', ['set_id', 'minifig_id', 'quantity', 'role'], $rows, ['quantity'], 'set_id, minifig_id, role')];
    }

    // --- Chunk helpers -----------------------------------------------------

    /**
     * Insert a chunk's elements, then their codes.
     *
     * Element ids have to be read back before the codes can be written, and the full
     * (part, colour) to id map is far too large to hold for the whole file — so it is
     * rebuilt per chunk, for that chunk's pairs only.
     *
     * @param list<array{int, int, string}> $chunk
     *
     * @return array{int, int}
     */
    private function flushElementChunk(array $chunk): array
    {
        if ([] === $chunk) {
            return [0, 0];
        }

        $elementRows = [];
        $pairs = [];
        foreach ($chunk as [$partId, $colorId, $code]) {
            $key = $partId.':'.$colorId;
            if (!isset($pairs[$key])) {
                $pairs[$key] = [$partId, $colorId];
                $elementRows[] = [$partId, $colorId];
            }
        }

        $written = $this->upsert('element', ['part_id', 'color_id'], $elementRows, ['part_id'], 'part_id, color_id');
        $ids = $this->elementIdsFor($pairs);

        $codeRows = [];
        $primarySeen = [];
        foreach ($chunk as [$partId, $colorId, $code]) {
            $elementId = $ids[$partId.':'.$colorId] ?? null;
            if (null === $elementId || '' === $code) {
                continue;
            }
            $isPrimary = isset($primarySeen[$elementId]) ? 0 : 1;
            $primarySeen[$elementId] = true;
            $codeRows[] = [$elementId, $code, ElementCodeSource::LegoElementId->value, $isPrimary];
        }

        $codes = $this->upsert('element_code', ['element_id', 'code', 'source', 'is_primary'], $codeRows, ['element_id'], 'code, source');

        return [$written, $codes];
    }

    /**
     * @param list<array{int, int, string, int, int, string}> $chunk
     *
     * @return array{int, int}
     */
    private function flushInventoryPartChunk(array $chunk): array
    {
        if ([] === $chunk) {
            return [0, 0];
        }

        $pairs = [];
        $elementRows = [];
        foreach ($chunk as [$partId, $colorId]) {
            $key = $partId.':'.$colorId;
            if (!isset($pairs[$key])) {
                $pairs[$key] = [$partId, $colorId];
                $elementRows[] = [$partId, $colorId];
            }
        }
        // An inventory can name a (part, colour) the elements file never listed; the
        // set is evidence enough that the combination exists.
        $this->upsert('element', ['part_id', 'color_id'], $elementRows, ['part_id'], 'part_id, color_id');
        $ids = $this->elementIdsFor($pairs);

        // Summed by key rather than appended: MySQL resolves two rows with the same
        // unique key inside one INSERT by letting the last one win, which would quietly
        // drop a quantity. The source has no such duplicates today, so this is a guard
        // rather than a fix — but a silent wrong quantity is not worth the risk.
        $setTotals = [];
        $minifigTotals = [];
        foreach ($chunk as [$partId, $colorId, $kind, $ownerId, $quantity, $role]) {
            $elementId = $ids[$partId.':'.$colorId] ?? null;
            if (null === $elementId) {
                continue;
            }
            if ('set' === $kind) {
                $key = $ownerId.':'.$elementId.':'.$role;
                $setTotals[$key] = ($setTotals[$key] ?? [$ownerId, $elementId, 0, $role]);
                $setTotals[$key][2] += $quantity;
            } else {
                $key = $ownerId.':'.$elementId.':'.$role;
                $minifigTotals[$key] = ($minifigTotals[$key] ?? [$ownerId, $elementId, 0, $role]);
                $minifigTotals[$key][2] += $quantity;
            }
        }

        $setRows = [];
        foreach ($setTotals as [$ownerId, $elementId, $quantity, $role]) {
            $setRows[] = [$ownerId, $elementId, $quantity, $role, 0];
        }
        $minifigRows = [];
        foreach ($minifigTotals as [$ownerId, $elementId, $quantity, $role]) {
            $minifigRows[] = [$ownerId, $elementId, $quantity, $role];
        }

        $setLines = $this->upsert('set_element', ['set_id', 'element_id', 'quantity', 'role', 'match_group'], $setRows, ['quantity'], 'set_id, element_id, role, match_group');
        $minifigLines = $this->upsert('minifig_element', ['minifig_id', 'element_id', 'quantity', 'role'], $minifigRows, ['quantity'], 'minifig_id, element_id, role');

        return [$setLines, $minifigLines];
    }

    /**
     * @param array<string, array{int, int}> $pairs
     *
     * @return array<string, int> "partId:colorId" => element id
     */
    private function elementIdsFor(array $pairs): array
    {
        $ids = [];
        foreach (array_chunk($pairs, 1000, true) as $batch) {
            $conditions = implode(' OR ', array_fill(0, \count($batch), '(part_id = ? AND color_id = ?)'));
            $params = [];
            foreach ($batch as [$partId, $colorId]) {
                $params[] = $partId;
                $params[] = $colorId;
            }
            foreach ($this->connection->fetchAllAssociative(
                'SELECT id, part_id, color_id FROM element WHERE '.$conditions,
                $params,
            ) as $row) {
                $ids[$row['part_id'].':'.$row['color_id']] = (int) $row['id'];
            }
        }

        return $ids;
    }

    /** @param list<array<int, mixed>> $rows */
    private function flushSets(array $rows): int
    {
        return $this->upsert(
            '`sets`',
            ['number', 'base_number', 'variant', 'name', 'year', 'theme_id', 'num_parts', 'image_url', 'rebrickable_id', 'created_at'],
            $rows,
            ['name', 'year', 'theme_id', 'num_parts', 'image_url'],
            'number',
        );
    }

    // --- Plumbing ----------------------------------------------------------

    /**
     * Batched INSERT ... ON DUPLICATE KEY UPDATE.
     *
     * $updateColumns says what a re-import is allowed to overwrite; anything left out
     * keeps whatever is in the database, which is how hand corrections survive. The
     * row alias form is used rather than VALUES(), which MySQL deprecated in 8.0.20.
     *
     * @param list<string>            $columns
     * @param list<array<int, mixed>> $rows
     * @param list<string>            $updateColumns
     */
    private function upsert(string $table, array $columns, array $rows, array $updateColumns, string $conflictKey = ''): int
    {
        if ([] === $rows) {
            return 0;
        }

        $columnList = implode(', ', array_map(static fn (string $c): string => '`'.$c.'`', $columns));
        $placeholder = '('.implode(', ', array_fill(0, \count($columns), '?')).')';
        $updates = implode(', ', array_map(static fn (string $c): string => '`'.$c.'` = new.`'.$c.'`', $updateColumns));
        $total = 0;

        foreach (array_chunk($rows, self::BATCH) as $batch) {
            $sql = \sprintf(
                'INSERT INTO %s (%s) VALUES %s AS new ON DUPLICATE KEY UPDATE %s',
                $table,
                $columnList,
                implode(', ', array_fill(0, \count($batch), $placeholder)),
                $updates,
            );
            $params = [];
            foreach ($batch as $row) {
                foreach ($row as $value) {
                    $params[] = $value;
                }
            }
            $this->connection->executeStatement($sql, $params);
            $total += \count($batch);
        }

        return $total;
    }

    /**
     * Rebrickable writes booleans as "True"/"False", not the "t"/"f" that the
     * Postgres-shaped dumps of other catalogues use. Reading only "t" silently filed
     * every spare part as a regular one, where it then collided with the real regular
     * line on the unique key and overwrote its quantity. Accept the obvious spellings.
     */
    private static function truthy(string $value): bool
    {
        return \in_array(strtolower(trim($value)), ['t', 'true', '1', 'y', 'yes'], true);
    }

    /** @return array<string, int> */
    private function map(string $sql): array
    {
        $out = [];
        foreach ($this->connection->fetchAllNumeric($sql) as [$key, $id]) {
            $out[(string) $key] = (int) $id;
        }

        return $out;
    }

    private function loadPartIds(): void
    {
        if ([] === $this->partIds) {
            $this->partIds = $this->map('SELECT number, id FROM part');
        }
    }

    private function loadColorIds(): void
    {
        if ([] === $this->colorIds) {
            foreach ($this->map('SELECT rebrickable_id, id FROM color WHERE rebrickable_id IS NOT NULL') as $key => $id) {
                $this->colorIds[(int) $key] = $id;
            }
        }
    }

    private function loadSetIds(): void
    {
        if ([] === $this->setIds) {
            $this->setIds = $this->map('SELECT number, id FROM `sets`');
        }
    }

    private function loadMinifigIds(): void
    {
        if ([] === $this->minifigIds) {
            $this->minifigIds = $this->map('SELECT number, id FROM minifig');
        }
    }

    private function rebrickableTaxonomyId(): int
    {
        $taxonomy = $this->em->getRepository(Taxonomy::class)->findOneBy(['slug' => 'rebrickable']);
        if (null === $taxonomy) {
            throw new \RuntimeException('The "rebrickable" taxonomy is missing. Run app:seed first.');
        }

        return (int) $taxonomy->getId();
    }

    /**
     * A URL-safe slug that is not taken yet, falling back to a suffix when it is.
     *
     * @param array<string, int> $taken slug => id, updated in place
     */
    private function uniqueSlug(string $name, array &$taken, string $suffix): string
    {
        $base = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT', $name) ?: $name) ?? '', '-'));
        $base = '' === $base ? 'item' : $base;
        $slug = $base;
        if (isset($taken[$slug])) {
            $slug = $base.'-'.strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $suffix) ?? $suffix);
        }
        $taken[$slug] = 1;

        return mb_substr($slug, 0, 120);
    }
}
