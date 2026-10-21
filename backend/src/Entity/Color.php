<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\ColorFinish;
use App\Repository\ColorRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A catalogue colour, e.g. "Trans-Dark Blue".
 *
 * Two independent axes: the family (hue) it is filed under, and the finish. Both are
 * needed — "Trans-Dark Blue" and "Dark Blue" share a family and differ in finish.
 *
 * One row is special: the sentinel named by COLOR_NOT_APPLICABLE, for parts that have
 * no colour of their own (sticker sheets, instruction booklets). A sentinel row beats
 * a nullable colour on Element, because it keeps the (part, colour) unique constraint
 * meaningful — MySQL does not enforce uniqueness across rows where a column is NULL.
 */
#[ORM\Entity(repositoryClass: ColorRepository::class)]
#[ORM\Table(name: 'color')]
#[ORM\Index(name: 'idx_color_family', columns: ['family_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch()],
    normalizationContext: ['groups' => ['color:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['color:write']],
    order: ['name' => 'ASC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'finish', filter: new BackedEnumFilter(), property: 'finish')]
#[QueryParameter(key: 'family', filter: new IriFilter(), property: 'family')]
#[QueryParameter(key: 'bricklinkId', filter: new ExactFilter(), property: 'bricklinkId')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class Color
{
    /** Slug of the sentinel colour used by parts that have no colour. */
    public const NOT_APPLICABLE = 'not-applicable';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['color:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 128, unique: true)]
    #[Groups(['color:read', 'color:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 128, unique: true)]
    #[Groups(['color:read', 'color:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    /** "#RRGGBB" as published by the catalogs. */
    #[ORM\Column(length: 7, nullable: true)]
    #[Groups(['color:read', 'color:write', 'catalog:summary'])]
    private ?string $hex = null;

    #[ORM\Column(enumType: ColorFinish::class, options: ['default' => 'solid'])]
    #[Groups(['color:read', 'color:write', 'catalog:summary'])]
    private ColorFinish $finish = ColorFinish::Solid;

    #[ORM\ManyToOne(targetEntity: ColorFamily::class, inversedBy: 'colors')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['color:read', 'color:write', 'catalog:summary'])]
    private ?ColorFamily $family = null;

    /** LEGO's own name for the colour, which rarely matches the catalogues'. */
    #[ORM\Column(length: 128, nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?string $legoName = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?int $legoId = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?int $bricklinkId = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?int $ldrawId = null;

    /** Rebrickable's colour id, the key the importer joins on. */
    #[ORM\Column(nullable: true, unique: true)]
    #[Groups(['color:read'])]
    private ?int $rebrickableId = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?int $yearFrom = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?int $yearTo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['color:read', 'color:write'])]
    private ?string $notes = null;

    /** @var Collection<int, Element> */
    #[ORM\OneToMany(targetEntity: Element::class, mappedBy: 'color')]
    private Collection $elements;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->elements = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): void
    {
        $this->slug = $slug;
    }

    public function getHex(): ?string
    {
        return $this->hex;
    }

    public function setHex(?string $hex): void
    {
        $this->hex = $hex;
    }

    public function getFinish(): ColorFinish
    {
        return $this->finish;
    }

    public function setFinish(ColorFinish $finish): void
    {
        $this->finish = $finish;
    }

    public function getFamily(): ?ColorFamily
    {
        return $this->family;
    }

    public function setFamily(?ColorFamily $family): void
    {
        $this->family = $family;
    }

    public function getLegoName(): ?string
    {
        return $this->legoName;
    }

    public function setLegoName(?string $legoName): void
    {
        $this->legoName = $legoName;
    }

    public function getLegoId(): ?int
    {
        return $this->legoId;
    }

    public function setLegoId(?int $legoId): void
    {
        $this->legoId = $legoId;
    }

    public function getBricklinkId(): ?int
    {
        return $this->bricklinkId;
    }

    public function setBricklinkId(?int $bricklinkId): void
    {
        $this->bricklinkId = $bricklinkId;
    }

    public function getLdrawId(): ?int
    {
        return $this->ldrawId;
    }

    public function setLdrawId(?int $ldrawId): void
    {
        $this->ldrawId = $ldrawId;
    }

    public function getRebrickableId(): ?int
    {
        return $this->rebrickableId;
    }

    public function setRebrickableId(?int $rebrickableId): void
    {
        $this->rebrickableId = $rebrickableId;
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

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** @return Collection<int, Element> */
    public function getElements(): Collection
    {
        return $this->elements;
    }

    #[Groups(['color:read', 'catalog:summary'])]
    public function isTransparent(): bool
    {
        return ColorFinish::Transparent === $this->finish;
    }
}
