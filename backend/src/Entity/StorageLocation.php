<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\StorageGranularity;
use App\Repository\StorageLocationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A real container: a room, a cabinet, a drawer, a bin.
 *
 * A tree, because that is how storage actually nests. $granularity records how finely
 * this container is sorted, following Brick Architect's progression from no organisation,
 * to by group, to by part, to by part and colour — which is to say, by element. A drawer
 * labelled "1x Plates" is Category; a drawer of red 2 x 4s is Element.
 *
 * The matching nullable pointer says what it is a container *for*, so a bin can be
 * labelled and checked against its contents. Only the one that matches the granularity
 * should be set.
 *
 * One row is special: the sentinel named by UNSORTED. OwnedElement requires a location,
 * so that the (element, condition, location) constraint stays enforceable — MySQL treats
 * every NULL as distinct — and unassigned pieces go here instead of to NULL.
 */
#[ORM\Entity(repositoryClass: StorageLocationRepository::class)]
#[ORM\Table(name: 'storage_location')]
#[ORM\Index(name: 'idx_storage_location_parent', columns: ['parent_id'])]
#[ORM\Index(name: 'idx_storage_location_path', columns: ['path'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['storage_location:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['storage_location:write']],
    order: ['path' => 'ASC', 'sortOrder' => 'ASC', 'name' => 'ASC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'parent', filter: new IriFilter(), property: 'parent')]
#[QueryParameter(key: 'granularity', filter: new BackedEnumFilter(), property: 'granularity')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'path', filter: new PartialSearchFilter(), property: 'path')]
class StorageLocation
{
    /** Slug of the sentinel location that holds anything not filed yet. */
    public const UNSORTED = 'unsorted';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['storage_location:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private ?self $parent = null;

    /** @var Collection<int, self> */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent')]
    #[ORM\OrderBy(['sortOrder' => 'ASC', 'name' => 'ASC'])]
    private Collection $children;

    #[ORM\Column(length: 128)]
    #[Groups(['storage_location:read', 'storage_location:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 160, unique: true)]
    #[Groups(['storage_location:read', 'storage_location:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    /** What is written on the physical label, if that differs from the name. */
    #[ORM\Column(length: 64, nullable: true)]
    #[Groups(['storage_location:read', 'storage_location:write', 'catalog:summary'])]
    private ?string $label = null;

    #[ORM\Column(enumType: StorageGranularity::class, options: ['default' => 'mixed'])]
    #[Groups(['storage_location:read', 'storage_location:write', 'catalog:summary'])]
    private StorageGranularity $granularity = StorageGranularity::Mixed;

    /** Set when granularity is Category. */
    #[ORM\ManyToOne(targetEntity: PartCategory::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private ?PartCategory $forCategory = null;

    /** Set when granularity is Part. */
    #[ORM\ManyToOne(targetEntity: Part::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private ?Part $forPart = null;

    /** Set when granularity is Element. */
    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private ?Element $forElement = null;

    /** Derived, as on PartCategory. */
    #[ORM\Column(length: 512, options: ['default' => ''])]
    #[Groups(['storage_location:read', 'catalog:summary'])]
    private string $path = '';

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['storage_location:read'])]
    private int $depth = 0;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private int $sortOrder = 0;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['storage_location:read', 'storage_location:write'])]
    private ?string $notes = null;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->children = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getParent(): ?self
    {
        return $this->parent;
    }

    public function setParent(?self $parent): void
    {
        $this->parent = $parent;
    }

    /** @return Collection<int, self> */
    public function getChildren(): Collection
    {
        return $this->children;
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

    public function getLabel(): ?string
    {
        return $this->label;
    }

    public function setLabel(?string $label): void
    {
        $this->label = $label;
    }

    public function getGranularity(): StorageGranularity
    {
        return $this->granularity;
    }

    public function setGranularity(StorageGranularity $granularity): void
    {
        $this->granularity = $granularity;
    }

    public function getForCategory(): ?PartCategory
    {
        return $this->forCategory;
    }

    public function setForCategory(?PartCategory $forCategory): void
    {
        $this->forCategory = $forCategory;
    }

    public function getForPart(): ?Part
    {
        return $this->forPart;
    }

    public function setForPart(?Part $forPart): void
    {
        $this->forPart = $forPart;
    }

    public function getForElement(): ?Element
    {
        return $this->forElement;
    }

    public function setForElement(?Element $forElement): void
    {
        $this->forElement = $forElement;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getDepth(): int
    {
        return $this->depth;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int $sortOrder): void
    {
        $this->sortOrder = $sortOrder;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** See PartCategory::rebuildPath() — same contract. */
    public function rebuildPath(): void
    {
        $slugs = [$this->slug];
        $node = $this->parent;
        $guard = 0;
        while (null !== $node && $guard++ < 32) {
            array_unshift($slugs, $node->getSlug());
            $node = $node->getParent();
        }

        $this->path = mb_substr(implode('/', $slugs), 0, 512);
        $this->depth = \count($slugs) - 1;
    }

    #[Groups(['storage_location:read', 'catalog:summary'])]
    public function getFullName(): string
    {
        $names = [$this->name];
        $node = $this->parent;
        $guard = 0;
        while (null !== $node && $guard++ < 32) {
            array_unshift($names, $node->getName());
            $node = $node->getParent();
        }

        return implode(' / ', $names);
    }
}
