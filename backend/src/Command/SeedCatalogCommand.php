<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Color;
use App\Entity\ColorFamily;
use App\Entity\PartCategory;
use App\Entity\StorageLocation;
use App\Entity\Taxonomy;
use App\Entity\WantedList;
use App\Enum\ColorFinish;
use App\Enum\StorageGranularity;
use App\Enum\TaxonomySource;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Console\Command\Command;

/**
 * Puts the fixed lookup rows in place: colour families, the three taxonomies, and the
 * two sentinel rows the schema depends on.
 *
 * Idempotent — it matches on slug and leaves anything that already exists alone, so it
 * is safe to re-run after a migration adds something.
 */
#[AsCommand(
    name: 'app:seed',
    description: 'Seed colour families, taxonomies and the sentinel colour and storage rows',
)]
final class SeedCatalogCommand extends Command
{
    /** BrickLink's eleven colour families, with a representative swatch. */
    private const FAMILIES = [
        ['Black', 'black', '#212121'],
        ['Blue', 'blue', '#0055BF'],
        ['Brown', 'brown', '#583927'],
        ['Gray', 'gray', '#9BA19D'],
        ['Green', 'green', '#237841'],
        ['Orange', 'orange', '#FE8A18'],
        ['Pink', 'pink', '#FC97AC'],
        ['Purple', 'purple', '#81007B'],
        ['Red', 'red', '#C91A09'],
        ['White', 'white', '#FFFFFF'],
        ['Yellow', 'yellow', '#F2CD37'],
    ];

    /**
     * Brick Architect's twelve top-level categories, with his own codes. Functional
     * rather than shape-based: a 1 x 2 brick with side studs is SNOT here and
     * "Brick, Modified" on BrickLink.
     */
    private const BRICK_ARCHITECT_CATEGORIES = [
        ['BASIC', 'basic', '1'],
        ['WALL', 'wall', '2'],
        ['SNOT', 'snot', '3'],
        ['ANGLE', 'angle', '7'],
        ['CURVE', 'curve', '8'],
        ['VEHICLE', 'vehicle', '9'],
        ['MINIFIG', 'minifig', '10'],
        ['NATURE', 'nature', '11'],
        ['TECHNIC', 'technic', '12'],
        ['ELECTRONICS', 'electronics', '13'],
        ['ARTICULATION', 'articulation', '106'],
        ['DUPLO', 'duplo', '89'],
    ];

    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $created = [];

        $familyRepo = $this->em->getRepository(ColorFamily::class);
        foreach (self::FAMILIES as $i => [$name, $slug, $hex]) {
            if (null !== $familyRepo->findOneBy(['slug' => $slug])) {
                continue;
            }
            $family = new ColorFamily($name, $slug);
            $family->setSwatchHex($hex);
            $family->setSortOrder($i);
            $this->em->persist($family);
            $created['colour families'] = ($created['colour families'] ?? 0) + 1;
        }

        $colorRepo = $this->em->getRepository(Color::class);
        if (null === $colorRepo->findOneBy(['slug' => Color::NOT_APPLICABLE])) {
            // Parts with no colour of their own — sticker sheets, instruction booklets —
            // still need an element row, and a sentinel keeps element's unique key real.
            $notApplicable = new Color('(Not Applicable)', Color::NOT_APPLICABLE);
            $notApplicable->setFinish(ColorFinish::Other);
            $this->em->persist($notApplicable);
            $created['sentinel colour'] = 1;
        }

        $taxonomyRepo = $this->em->getRepository(Taxonomy::class);
        $taxonomies = [
            ['Rebrickable', 'rebrickable', TaxonomySource::Rebrickable, true,
                'The flat list that ships with the Rebrickable dumps. Default because it is the one the importer fills.'],
            ['BrickLink', 'bricklink', TaxonomySource::BrickLink, false,
                'Shape-based, as on BrickLink: Brick, then Modified, then Decorated. Built as a real tree here, where BrickLink flattens it into comma-separated names.'],
            ['Brick Architect', 'brick-architect', TaxonomySource::BrickArchitect, false,
                'Functional, after Tom Alphin: twelve categories named for what you build with the part rather than what shape it is.'],
        ];
        foreach ($taxonomies as [$name, $slug, $source, $isDefault, $description]) {
            $taxonomy = $taxonomyRepo->findOneBy(['slug' => $slug]);
            if (null === $taxonomy) {
                $taxonomy = new Taxonomy($name, $slug, $source);
                $taxonomy->setIsDefault($isDefault);
                $taxonomy->setDescription($description);
                $this->em->persist($taxonomy);
                $created['taxonomies'] = ($created['taxonomies'] ?? 0) + 1;
            }

            if ('brick-architect' === $slug) {
                $this->em->flush();
                $created['Brick Architect categories'] = $this->seedBrickArchitect($taxonomy);
            }
        }

        $locationRepo = $this->em->getRepository(StorageLocation::class);
        if (null === $locationRepo->findOneBy(['slug' => StorageLocation::UNSORTED])) {
            // OwnedElement requires a location; this is where anything unfiled goes.
            $unsorted = new StorageLocation('Unsorted', StorageLocation::UNSORTED);
            $unsorted->setGranularity(StorageGranularity::Mixed);
            $unsorted->setNotes('Everything not yet filed into a real container.');
            $unsorted->rebuildPath();
            $this->em->persist($unsorted);
            $created['sentinel storage location'] = 1;
        }

        $wantedRepo = $this->em->getRepository(WantedList::class);
        if (null === $wantedRepo->findOneBy(['slug' => 'wanted'])) {
            $this->em->persist(new WantedList('Wanted', 'wanted'));
            $created['wanted lists'] = 1;
        }

        $this->em->flush();

        if ([] === $created) {
            $io->success('Nothing to do: everything is already seeded.');

            return Command::SUCCESS;
        }

        $io->success('Seeded.');
        $io->table(['What', 'Created'], array_map(null, array_keys($created), array_values($created)));

        return Command::SUCCESS;
    }

    private function seedBrickArchitect(Taxonomy $taxonomy): int
    {
        $repo = $this->em->getRepository(PartCategory::class);
        $count = 0;
        foreach (self::BRICK_ARCHITECT_CATEGORIES as $i => [$name, $slug, $code]) {
            if (null !== $repo->findOneBy(['taxonomy' => $taxonomy, 'slug' => $slug])) {
                continue;
            }
            $category = new PartCategory($taxonomy, $name, $slug);
            $category->setExternalCode($code);
            $category->setSortOrder($i);
            $category->rebuildPath();
            $this->em->persist($category);
            ++$count;
        }

        return $count;
    }
}
