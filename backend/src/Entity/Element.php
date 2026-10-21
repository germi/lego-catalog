<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\FreeTextQueryFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\ElementRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * A shape in one colour: the piece you can actually hold.
 *
 * Part x Colour, and the row's existence is itself the fact that LEGO made that shape
 * in that colour — this table is what BrickLink shows as "Known Colors". Everything
 * that is true of a shape-in-a-colour rather than of the shape lives here: the element
 * IDs, the per-colour image, the years that combination was in production.
 *
 * Sets and minifigures are inventoried in elements, never in parts. "Five of these" is
 * only answerable once the colour is pinned down.
 */
#[ORM\Entity(repositoryClass: ElementRepository::class)]
#[ORM\Table(name: 'element')]
#[ORM\UniqueConstraint(name: 'uniq_element_part_color', columns: ['part_id', 'color_id'])]
#[ORM\Index(name: 'idx_element_color', columns: ['color_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['element:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['element:write']],
    order: ['part.number' => 'ASC', 'color.name' => 'ASC'],
    paginationItemsPerPage: 60,
)]
#[QueryParameter(
    key: 'q',
    filter: new FreeTextQueryFilter(new OrFilter(new PartialSearchFilter()), ['part.name', 'part.number', 'codes.code']),
    properties: ['part.name', 'part.number', 'codes.code'],
)]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'part')]
#[QueryParameter(key: 'color', filter: new IriFilter(), property: 'color')]
#[QueryParameter(key: 'colorFamily', filter: new IriFilter(), property: 'color.family')]
#[QueryParameter(key: 'category', filter: new IriFilter(), property: 'part.categoryAssignments.category')]
#[QueryParameter(key: 'code', filter: new ExactFilter(), property: 'codes.code')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class Element
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['element:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Part::class, inversedBy: 'elements')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['element:read', 'element:write', 'catalog:summary'])]
    private Part $part;

    #[ORM\ManyToOne(targetEntity: Color::class, inversedBy: 'elements')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['element:read', 'element:write', 'catalog:summary'])]
    private Color $color;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['element:read', 'element:write', 'catalog:summary'])]
    private ?string $imageUrl = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['element:read', 'element:write'])]
    private ?int $yearFrom = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['element:read', 'element:write'])]
    private ?int $yearTo = null;

    /** False once the combination is out of production. */
    #[ORM\Column(options: ['default' => true])]
    #[Groups(['element:read', 'element:write'])]
    private bool $isActive = true;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['element:read', 'element:write'])]
    private ?string $notes = null;

    /** @var Collection<int, ElementCode> */
    #[ORM\OneToMany(targetEntity: ElementCode::class, mappedBy: 'element', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[Groups(['element:read', 'catalog:summary'])]
    private Collection $codes;

    public function __construct(?Part $part = null, ?Color $color = null)
    {
        if (null !== $part) {
            $this->part = $part;
        }
        if (null !== $color) {
            $this->color = $color;
        }
        $this->codes = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPart(): Part
    {
        return $this->part;
    }

    public function setPart(Part $part): void
    {
        $this->part = $part;
    }

    public function getColor(): Color
    {
        return $this->color;
    }

    public function setColor(Color $color): void
    {
        $this->color = $color;
    }

    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }

    public function setImageUrl(?string $imageUrl): void
    {
        $this->imageUrl = $imageUrl;
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

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): void
    {
        $this->isActive = $isActive;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** @return Collection<int, ElementCode> */
    public function getCodes(): Collection
    {
        return $this->codes;
    }

    public function addCode(ElementCode $code): void
    {
        if (!$this->codes->contains($code)) {
            $this->codes->add($code);
            $code->setElement($this);
        }
    }

    // --- Derived, read-only API fields -------------------------------------

    /** The element ID to show when there is only room for one. */
    #[Groups(['element:read', 'catalog:summary'])]
    public function getPrimaryCode(): ?string
    {
        $fallback = null;
        foreach ($this->codes as $code) {
            if ($code->isPrimary()) {
                return $code->getCode();
            }
            $fallback ??= $code->getCode();
        }

        return $fallback;
    }

    /**
     * "Brick 2 x 4 (Red)". Assembled from the part and colour names exactly as the
     * catalogues wrote them — this is data, not a label, so it is not translated.
     */
    #[Groups(['element:read', 'catalog:summary'])]
    public function getDisplayName(): string
    {
        return $this->part->getName().' ('.$this->color->getName().')';
    }
}
