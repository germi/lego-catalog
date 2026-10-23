<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\FreeTextQueryFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\RangeFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\PartMaterial;
use App\Repository\PartRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A shape. The mould, with no colour of its own: "Brick 2 x 4" is part 3001.
 *
 * This is the distinction the whole catalogue turns on. A Part is a shape; an Element
 * is that shape in one colour. LEGO calls them Design ID and Element ID; the number
 * moulded under the studs is the Design ID, and it does not change with colour.
 *
 * A print is a separate Part, not a flag on an element. BrickLink gives the decorated
 * head its own number (3626cpb0001) and links it to the plain mould 3626c, because the
 * print then exists in its own set of colours — which a colour attribute could not
 * express. See PartRelationship and PartRelationType::Print.
 *
 * $number is a string and always will be: part numbers are alphanumeric (3001, 3626cpb0001,
 * x224, 973pb1234c01) and only look like integers by coincidence.
 *
 * Weight and stud dimensions are FLOAT, not DECIMAL, for the same reason prices are in
 * the price tracker: Doctrine maps DECIMAL to a PHP string, that string type reaches the
 * Serializer through PropertyInfo, and the Serializer then refuses a JSON number on write.
 * These are measurements to display and sort by, never summed into a ledger, so a double
 * is accurate enough and the API keeps returning plain numbers.
 */
#[ORM\Entity(repositoryClass: PartRepository::class)]
#[ORM\Table(name: 'part')]
#[ORM\Index(name: 'idx_part_name', columns: ['name'])]
#[ORM\Index(name: 'idx_part_primary_category', columns: ['primary_category_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['part:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['part:write']],
    order: ['number' => 'ASC'],
    paginationItemsPerPage: 60,
    // The client decides its own page size; without this the request's itemsPerPage is
    // silently ignored and the number above wins, which makes the UI and the API disagree.
    paginationClientItemsPerPage: true,
    paginationMaximumItemsPerPage: 200,
)]
// One box that searches the name and every number the part ever answered to.
#[QueryParameter(
    key: 'q',
    filter: new FreeTextQueryFilter(new OrFilter(new PartialSearchFilter()), ['name', 'number', 'numbers.number']),
    properties: ['name', 'number', 'numbers.number'],
)]
#[QueryParameter(key: 'number', filter: new ExactFilter(), property: 'number')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'material', filter: new BackedEnumFilter(), property: 'material')]
#[QueryParameter(key: 'decorated', filter: new ExactFilter(), property: 'isDecorated')]
#[QueryParameter(key: 'primaryCategory', filter: new IriFilter(), property: 'primaryCategory')]
// Any taxonomy: ?category=/api/part_categories/12 regardless of which tree it belongs to.
#[QueryParameter(key: 'category', filter: new IriFilter(), property: 'categoryAssignments.category')]
#[QueryParameter(key: 'categoryPath', filter: new PartialSearchFilter(), property: 'categoryAssignments.category.path')]
#[QueryParameter(key: 'color', filter: new IriFilter(), property: 'elements.color')]
#[QueryParameter(key: 'year', filter: new RangeFilter(), property: 'yearFrom')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class Part
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['part:read', 'catalog:summary'])]
    private ?int $id = null;

    /** The catalogue number people actually type. Alphanumeric. */
    #[ORM\Column(length: 64, unique: true)]
    #[Groups(['part:read', 'part:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $number;

    #[ORM\Column(length: 255)]
    #[Groups(['part:read', 'part:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    /**
     * A short label for bins and tight UI — Brick Architect's "simplified part name".
     * Catalogue names run long ("Brick, Modified 1 x 2 with Ledge, Studs on Side").
     */
    #[ORM\Column(length: 128, nullable: true)]
    #[Groups(['part:read', 'part:write', 'catalog:summary'])]
    private ?string $shortName = null;

    /**
     * Denormalised pointer to this part's category in the default taxonomy, so the
     * common parts list does not need the assignment join. The assignments are the
     * truth; app:categories:sync-primary recomputes this.
     */
    #[ORM\ManyToOne(targetEntity: PartCategory::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['part:read'])]
    private ?PartCategory $primaryCategory = null;

    #[ORM\Column(enumType: PartMaterial::class, options: ['default' => 'plastic'])]
    #[Groups(['part:read', 'part:write'])]
    private PartMaterial $material = PartMaterial::Plastic;

    /** Footprint and height in studs — 2, 4 and 1 for a 2 x 4 brick. */
    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    #[Assert\PositiveOrZero]
    private ?float $studX = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    #[Assert\PositiveOrZero]
    private ?float $studY = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    #[Assert\PositiveOrZero]
    private ?float $studZ = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    #[Assert\PositiveOrZero]
    private ?float $weightGrams = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    private ?int $yearFrom = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    private ?int $yearTo = null;

    /** True for printed and patterned parts. Derived from the relationships on import. */
    #[ORM\Column(options: ['default' => false])]
    #[Groups(['part:read', 'part:write', 'catalog:summary'])]
    private bool $isDecorated = false;

    #[ORM\Column(length: 64, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    private ?string $ldrawId = null;

    /** Rebrickable's part_num — the key a re-import joins on. */
    #[ORM\Column(length: 64, nullable: true, unique: true)]
    #[Groups(['part:read'])]
    private ?string $rebrickableId = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['part:read', 'part:write', 'catalog:summary'])]
    private ?string $imageUrl = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['part:read', 'part:write'])]
    private ?string $notes = null;

    #[ORM\Column]
    #[Groups(['part:read'])]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, Element> */
    #[ORM\OneToMany(targetEntity: Element::class, mappedBy: 'part', cascade: ['remove'], orphanRemoval: true)]
    private Collection $elements;

    /** @var Collection<int, PartNumber> */
    #[ORM\OneToMany(targetEntity: PartNumber::class, mappedBy: 'part', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[Groups(['part:read'])]
    private Collection $numbers;

    /** @var Collection<int, PartCategoryAssignment> */
    #[ORM\OneToMany(targetEntity: PartCategoryAssignment::class, mappedBy: 'part', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[Groups(['part:read'])]
    private Collection $categoryAssignments;

    /** Relationships where this part is the plainer / whole one. */
    /** @var Collection<int, PartRelationship> */
    #[ORM\OneToMany(targetEntity: PartRelationship::class, mappedBy: 'parentPart', cascade: ['remove'], orphanRemoval: true)]
    private Collection $childRelationships;

    /** @var Collection<int, PartRelationship> */
    #[ORM\OneToMany(targetEntity: PartRelationship::class, mappedBy: 'childPart', cascade: ['remove'], orphanRemoval: true)]
    private Collection $parentRelationships;

    public function __construct(string $number = '', string $name = '')
    {
        $this->number = $number;
        $this->name = $name;
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->elements = new ArrayCollection();
        $this->numbers = new ArrayCollection();
        $this->categoryAssignments = new ArrayCollection();
        $this->childRelationships = new ArrayCollection();
        $this->parentRelationships = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNumber(): string
    {
        return $this->number;
    }

    public function setNumber(string $number): void
    {
        $this->number = $number;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = mb_substr($name, 0, 255);
    }

    public function getShortName(): ?string
    {
        return $this->shortName;
    }

    public function setShortName(?string $shortName): void
    {
        $this->shortName = null === $shortName ? null : mb_substr($shortName, 0, 128);
    }

    public function getPrimaryCategory(): ?PartCategory
    {
        return $this->primaryCategory;
    }

    public function setPrimaryCategory(?PartCategory $primaryCategory): void
    {
        $this->primaryCategory = $primaryCategory;
    }

    public function getMaterial(): PartMaterial
    {
        return $this->material;
    }

    public function setMaterial(PartMaterial $material): void
    {
        $this->material = $material;
    }

    public function getStudX(): ?float
    {
        return $this->studX;
    }

    public function setStudX(?float $studX): void
    {
        $this->studX = $studX;
    }

    public function getStudY(): ?float
    {
        return $this->studY;
    }

    public function setStudY(?float $studY): void
    {
        $this->studY = $studY;
    }

    public function getStudZ(): ?float
    {
        return $this->studZ;
    }

    public function setStudZ(?float $studZ): void
    {
        $this->studZ = $studZ;
    }

    public function getWeightGrams(): ?float
    {
        return $this->weightGrams;
    }

    public function setWeightGrams(?float $weightGrams): void
    {
        $this->weightGrams = null === $weightGrams ? null : round($weightGrams, 3);
    }

    public function getYearFrom(): ?int
    {
        return $this->yearFrom;
    }

    public function setYearFrom(?int $yearFrom): void
    {
        $this->yearFrom = $yearFrom;
    }

    public function getYearTo(): ?int
    {
        return $this->yearTo;
    }

    public function setYearTo(?int $yearTo): void
    {
        $this->yearTo = $yearTo;
    }

    public function isDecorated(): bool
    {
        return $this->isDecorated;
    }

    public function setIsDecorated(bool $isDecorated): void
    {
        $this->isDecorated = $isDecorated;
    }

    public function getLdrawId(): ?string
    {
        return $this->ldrawId;
    }

    public function setLdrawId(?string $ldrawId): void
    {
        $this->ldrawId = $ldrawId;
    }

    public function getRebrickableId(): ?string
    {
        return $this->rebrickableId;
    }

    public function setRebrickableId(?string $rebrickableId): void
    {
        $this->rebrickableId = $rebrickableId;
    }

    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }

    public function setImageUrl(?string $imageUrl): void
    {
        $this->imageUrl = $imageUrl;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, Element> */
    public function getElements(): Collection
    {
        return $this->elements;
    }

    /** @return Collection<int, PartNumber> */
    public function getNumbers(): Collection
    {
        return $this->numbers;
    }

    public function addNumber(PartNumber $number): void
    {
        if (!$this->numbers->contains($number)) {
            $this->numbers->add($number);
            $number->setPart($this);
        }
    }

    /** @return Collection<int, PartCategoryAssignment> */
    public function getCategoryAssignments(): Collection
    {
        return $this->categoryAssignments;
    }

    public function addCategoryAssignment(PartCategoryAssignment $assignment): void
    {
        if (!$this->categoryAssignments->contains($assignment)) {
            $this->categoryAssignments->add($assignment);
            $assignment->setPart($this);
        }
    }

    /** This part's category in a given taxonomy, if it has one. */
    public function getCategoryIn(Taxonomy $taxonomy): ?PartCategory
    {
        foreach ($this->categoryAssignments as $assignment) {
            if ($assignment->getTaxonomy() === $taxonomy) {
                return $assignment->getCategory();
            }
        }

        return null;
    }

    /** @return Collection<int, PartRelationship> */
    public function getChildRelationships(): Collection
    {
        return $this->childRelationships;
    }

    /** @return Collection<int, PartRelationship> */
    public function getParentRelationships(): Collection
    {
        return $this->parentRelationships;
    }

    // --- Derived, read-only API fields -------------------------------------

    /** How many colours this shape is known to have been made in. */
    #[Groups(['part:read', 'catalog:summary'])]
    public function getKnownColorCount(): int
    {
        return $this->elements->count();
    }

    /**
     * Related shapes, flattened to what a client needs: the other part's number and
     * name, the relation type, and which end of it this part sits on.
     *
     * Flattened rather than serialised as entities on purpose. PartRelationship points
     * at Part on both sides, so exposing it inside part:read made the serializer — and
     * API Platform's eager loader — walk Part to relationship to Part without end.
     *
     * @return list<array{type: string, direction: string, number: string, name: string}>
     */
    #[Groups(['part:read'])]
    public function getRelatedParts(): array
    {
        $out = [];
        foreach ($this->childRelationships as $relation) {
            $out[] = [
                'type' => $relation->getType()->value,
                // This part is the plainer or whole one; the other is derived from it.
                'direction' => 'child',
                'number' => $relation->getChildPart()->getNumber(),
                'name' => $relation->getChildPart()->getName(),
            ];
        }
        foreach ($this->parentRelationships as $relation) {
            $out[] = [
                'type' => $relation->getType()->value,
                'direction' => 'parent',
                'number' => $relation->getParentPart()->getNumber(),
                'name' => $relation->getParentPart()->getName(),
            ];
        }

        return $out;
    }

    /** "2 x 4", or "2 x 4 x 3" when the part has a height worth stating. */
    #[Groups(['part:read', 'catalog:summary'])]
    public function getStudSize(): ?string
    {
        if (null === $this->studX || null === $this->studY) {
            return null;
        }

        $fmt = static fn (float $v): string => rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.');
        $size = $fmt($this->studX).' x '.$fmt($this->studY);

        return null === $this->studZ ? $size : $size.' x '.$fmt($this->studZ);
    }
}
