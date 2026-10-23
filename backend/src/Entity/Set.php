<?php

declare(strict_types=1);

namespace App\Entity;

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
use App\Repository\SetRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A boxed product.
 *
 * The table is "sets", not "set": SET is a MySQL keyword and a table of that name would
 * need quoting everywhere. (The class name is fine — Set is not reserved in PHP. It was
 * List that bit us in the price tracker.)
 *
 * Catalogue set numbers carry a variant suffix — 10179-1 is the first release of 10179 —
 * so the number is stored whole for lookups and split into $baseNumber and $variant for
 * "show me every release of this set".
 *
 * $numParts is denormalised for listing. It counts regular set_element lines only, so it
 * excludes two things: spares, which are real pieces in the bag but not part of the
 * model, and parts that arrive inside minifigures, which live in minifig_element. The
 * number on the box is the second of those added back — getBoxPieceCount() — and that
 * reconciles exactly against published counts. app:sets:recount rebuilds both.
 */
#[ORM\Entity(repositoryClass: SetRepository::class)]
#[ORM\Table(name: 'sets')]
#[ORM\Index(name: 'idx_sets_base_number', columns: ['base_number'])]
#[ORM\Index(name: 'idx_sets_theme', columns: ['theme_id'])]
#[ORM\Index(name: 'idx_sets_year', columns: ['year'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['set:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['set:write']],
    order: ['year' => 'DESC', 'number' => 'ASC'],
    paginationItemsPerPage: 48,
    // The client decides its own page size; without this the request's itemsPerPage is
    // silently ignored and the number above wins, which makes the UI and the API disagree.
    paginationClientItemsPerPage: true,
    paginationMaximumItemsPerPage: 200,
)]
#[QueryParameter(
    key: 'q',
    filter: new FreeTextQueryFilter(new OrFilter(new PartialSearchFilter()), ['name', 'number', 'baseNumber']),
    properties: ['name', 'number', 'baseNumber'],
)]
#[QueryParameter(key: 'number', filter: new ExactFilter(), property: 'number')]
#[QueryParameter(key: 'baseNumber', filter: new ExactFilter(), property: 'baseNumber')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'theme', filter: new IriFilter(), property: 'theme')]
#[QueryParameter(key: 'themePath', filter: new PartialSearchFilter(), property: 'theme.path')]
#[QueryParameter(key: 'year', filter: new RangeFilter(), property: 'year')]
#[QueryParameter(key: 'numParts', filter: new RangeFilter(), property: 'numParts')]
// Every set that uses a given element, or a given shape in any colour.
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'elementLines.element')]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'elementLines.element.part')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class Set
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['set:read', 'catalog:summary'])]
    private ?int $id = null;

    /** The whole catalogue number including the variant: "10179-1". */
    #[ORM\Column(length: 32, unique: true)]
    #[Groups(['set:read', 'set:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $number;

    /** "10179" — what is printed on the box. */
    #[ORM\Column(length: 24)]
    #[Groups(['set:read', 'set:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $baseNumber;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['set:read', 'set:write'])]
    #[Assert\Positive]
    private int $variant = 1;

    #[ORM\Column(length: 255)]
    #[Groups(['set:read', 'set:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(nullable: true)]
    #[Groups(['set:read', 'set:write', 'catalog:summary'])]
    private ?int $year = null;

    #[ORM\ManyToOne(targetEntity: Theme::class, inversedBy: 'sets')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['set:read', 'set:write'])]
    private ?Theme $theme = null;

    /** Regular lines only — see the class docblock. */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['set:read', 'catalog:summary'])]
    private int $numParts = 0;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['set:read', 'catalog:summary'])]
    private int $numMinifigs = 0;

    /**
     * Parts that arrive inside this set's minifigures, counted separately.
     *
     * They live in minifig_element, not set_element, so they are not in $numParts —
     * but the number on the box includes them. Keeping them apart means both
     * conventions are available and each one is unambiguous. See getBoxPieceCount().
     */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['set:read'])]
    private int $numMinifigParts = 0;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    #[Assert\PositiveOrZero]
    private ?float $weightGrams = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?float $boxWidthCm = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?float $boxHeightCm = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?float $boxDepthCm = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?\DateTimeImmutable $releasedOn = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?\DateTimeImmutable $retiredOn = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['set:read', 'set:write'])]
    private int $instructionsCount = 0;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['set:read', 'set:write', 'catalog:summary'])]
    private ?string $imageUrl = null;

    #[ORM\Column(length: 32, nullable: true, unique: true)]
    #[Groups(['set:read'])]
    private ?string $rebrickableId = null;

    /**
     * Which revision of the source inventory these lines came from.
     *
     * Rebrickable versions its inventories; we keep only the highest one, and record
     * which that was so a re-import can tell whether anything actually changed.
     */
    #[ORM\Column(nullable: true)]
    #[Groups(['set:read'])]
    private ?int $inventoryVersion = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['set:read', 'set:write'])]
    private ?string $notes = null;

    #[ORM\Column]
    #[Groups(['set:read'])]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, SetElement> */
    #[ORM\OneToMany(targetEntity: SetElement::class, mappedBy: 'set', cascade: ['remove'], orphanRemoval: true)]
    private Collection $elementLines;

    /** @var Collection<int, SetMinifig> */
    #[ORM\OneToMany(targetEntity: SetMinifig::class, mappedBy: 'set', cascade: ['remove'], orphanRemoval: true)]
    private Collection $minifigLines;

    /** Sets packaged inside this one. */
    /** @var Collection<int, SetSubset> */
    #[ORM\OneToMany(targetEntity: SetSubset::class, mappedBy: 'set', cascade: ['remove'], orphanRemoval: true)]
    private Collection $subsetLines;

    public function __construct(string $number = '', string $name = '')
    {
        $this->number = $number;
        $this->name = $name;
        [$this->baseNumber, $this->variant] = self::splitNumber($number);
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->elementLines = new ArrayCollection();
        $this->minifigLines = new ArrayCollection();
        $this->subsetLines = new ArrayCollection();
    }

    /**
     * "10179-1" to ["10179", 1]. A number with no suffix is variant 1.
     *
     * @return array{string, int}
     */
    public static function splitNumber(string $number): array
    {
        if (preg_match('/^(.+)-(\d+)$/', $number, $m)) {
            return [$m[1], (int) $m[2]];
        }

        return [$number, 1];
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNumber(): string
    {
        return $this->number;
    }

    /** Keeps the split fields in step — they are two views of one value. */
    public function setNumber(string $number): void
    {
        $this->number = $number;
        [$this->baseNumber, $this->variant] = self::splitNumber($number);
    }

    public function getBaseNumber(): string
    {
        return $this->baseNumber;
    }

    public function getVariant(): int
    {
        return $this->variant;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = mb_substr($name, 0, 255);
    }

    public function getYear(): ?int
    {
        return $this->year;
    }

    public function setYear(?int $year): void
    {
        $this->year = $year;
    }

    public function getTheme(): ?Theme
    {
        return $this->theme;
    }

    public function setTheme(?Theme $theme): void
    {
        $this->theme = $theme;
    }

    public function getNumParts(): int
    {
        return $this->numParts;
    }

    public function setNumParts(int $numParts): void
    {
        $this->numParts = $numParts;
    }

    public function getNumMinifigs(): int
    {
        return $this->numMinifigs;
    }

    public function setNumMinifigs(int $numMinifigs): void
    {
        $this->numMinifigs = $numMinifigs;
    }

    public function getNumMinifigParts(): int
    {
        return $this->numMinifigParts;
    }

    public function setNumMinifigParts(int $numMinifigParts): void
    {
        $this->numMinifigParts = $numMinifigParts;
    }

    /**
     * The piece count as printed on the box: loose parts plus minifigure parts,
     * spares excluded. Verified against 75192-1, whose box says 7,541.
     */
    #[Groups(['set:read', 'catalog:summary'])]
    public function getBoxPieceCount(): int
    {
        return $this->numParts + $this->numMinifigParts;
    }

    public function getWeightGrams(): ?float
    {
        return $this->weightGrams;
    }

    public function setWeightGrams(?float $weightGrams): void
    {
        $this->weightGrams = $weightGrams;
    }

    public function getBoxWidthCm(): ?float
    {
        return $this->boxWidthCm;
    }

    public function setBoxWidthCm(?float $boxWidthCm): void
    {
        $this->boxWidthCm = $boxWidthCm;
    }

    public function getBoxHeightCm(): ?float
    {
        return $this->boxHeightCm;
    }

    public function setBoxHeightCm(?float $boxHeightCm): void
    {
        $this->boxHeightCm = $boxHeightCm;
    }

    public function getBoxDepthCm(): ?float
    {
        return $this->boxDepthCm;
    }

    public function setBoxDepthCm(?float $boxDepthCm): void
    {
        $this->boxDepthCm = $boxDepthCm;
    }

    public function getReleasedOn(): ?\DateTimeImmutable
    {
        return $this->releasedOn;
    }

    public function setReleasedOn(?\DateTimeImmutable $releasedOn): void
    {
        $this->releasedOn = $releasedOn;
    }

    public function getRetiredOn(): ?\DateTimeImmutable
    {
        return $this->retiredOn;
    }

    public function setRetiredOn(?\DateTimeImmutable $retiredOn): void
    {
        $this->retiredOn = $retiredOn;
    }

    public function getInstructionsCount(): int
    {
        return $this->instructionsCount;
    }

    public function setInstructionsCount(int $instructionsCount): void
    {
        $this->instructionsCount = $instructionsCount;
    }

    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }

    public function setImageUrl(?string $imageUrl): void
    {
        $this->imageUrl = $imageUrl;
    }

    public function getRebrickableId(): ?string
    {
        return $this->rebrickableId;
    }

    public function setRebrickableId(?string $rebrickableId): void
    {
        $this->rebrickableId = $rebrickableId;
    }

    public function getInventoryVersion(): ?int
    {
        return $this->inventoryVersion;
    }

    public function setInventoryVersion(?int $inventoryVersion): void
    {
        $this->inventoryVersion = $inventoryVersion;
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

    /** @return Collection<int, SetElement> */
    public function getElementLines(): Collection
    {
        return $this->elementLines;
    }

    /** @return Collection<int, SetMinifig> */
    public function getMinifigLines(): Collection
    {
        return $this->minifigLines;
    }

    /** @return Collection<int, SetSubset> */
    public function getSubsetLines(): Collection
    {
        return $this->subsetLines;
    }
}
