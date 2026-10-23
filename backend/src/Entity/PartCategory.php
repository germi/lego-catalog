<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\PartCategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A node in one taxonomy's category tree.
 *
 * Hierarchy is stored twice on purpose: $parent is the truth, and $path is a
 * materialised "brick/modified/decorated" so that "everything under Brick" is one
 * indexed LIKE 'brick/%' instead of a recursive walk. $path and $depth are derived —
 * app:categories:rebuild-paths recomputes them, and nothing else should write them.
 *
 * $externalCode keeps the source's own identifier, so Brick Architect's SNOT stays 3
 * and a BrickLink category keeps its own number through a re-import.
 */
#[ORM\Entity(repositoryClass: PartCategoryRepository::class)]
#[ORM\Table(name: 'part_category')]
#[ORM\UniqueConstraint(name: 'uniq_part_category_taxonomy_slug', columns: ['taxonomy_id', 'slug'])]
// The source's own id is the stable identity of an imported category. Keying the import
// on the slug instead let a second run mint a suffixed slug and insert a twin of every
// category. NULL is allowed many times over, which is what hand-made categories need.
#[ORM\UniqueConstraint(name: 'uniq_part_category_taxonomy_code', columns: ['taxonomy_id', 'external_code'])]
#[ORM\Index(name: 'idx_part_category_path', columns: ['path'])]
#[ORM\Index(name: 'idx_part_category_parent', columns: ['parent_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['part_category:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['part_category:write']],
    order: ['path' => 'ASC', 'sortOrder' => 'ASC', 'name' => 'ASC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'taxonomy', filter: new IriFilter(), property: 'taxonomy')]
#[QueryParameter(key: 'parent', filter: new IriFilter(), property: 'parent')]
#[QueryParameter(key: 'depth', filter: new ExactFilter(), property: 'depth')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
// Subtree queries: ?path=brick/ matches the branch, because path is prefix-encoded.
#[QueryParameter(key: 'path', filter: new PartialSearchFilter(), property: 'path')]
class PartCategory
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['part_category:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Taxonomy::class, inversedBy: 'categories')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_category:read', 'part_category:write', 'catalog:summary'])]
    private Taxonomy $taxonomy;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['part_category:read', 'part_category:write'])]
    private ?self $parent = null;

    /** @var Collection<int, self> */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent')]
    #[ORM\OrderBy(['sortOrder' => 'ASC', 'name' => 'ASC'])]
    private Collection $children;

    /** The leaf name only — "Modified", not "Brick, Modified". */
    #[ORM\Column(length: 128)]
    #[Groups(['part_category:read', 'part_category:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 128)]
    #[Groups(['part_category:read', 'part_category:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    /** Derived: slugs of this node and its ancestors, "brick/modified/decorated". */
    #[ORM\Column(length: 512, options: ['default' => ''])]
    #[Groups(['part_category:read', 'catalog:summary'])]
    private string $path = '';

    /** Derived: 0 for a root. */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['part_category:read'])]
    private int $depth = 0;

    /** The source taxonomy's own code, e.g. 3 for Brick Architect's SNOT. */
    #[ORM\Column(length: 64, nullable: true)]
    #[Groups(['part_category:read', 'part_category:write'])]
    private ?string $externalCode = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['part_category:read', 'part_category:write'])]
    private int $sortOrder = 0;

    /** @var Collection<int, PartCategoryAssignment> */
    #[ORM\OneToMany(targetEntity: PartCategoryAssignment::class, mappedBy: 'category', cascade: ['remove'], orphanRemoval: true)]
    private Collection $assignments;

    public function __construct(?Taxonomy $taxonomy = null, string $name = '', string $slug = '')
    {
        if (null !== $taxonomy) {
            $this->taxonomy = $taxonomy;
        }
        $this->name = $name;
        $this->slug = $slug;
        $this->children = new ArrayCollection();
        $this->assignments = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTaxonomy(): Taxonomy
    {
        return $this->taxonomy;
    }

    public function setTaxonomy(Taxonomy $taxonomy): void
    {
        $this->taxonomy = $taxonomy;
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

    public function getPath(): string
    {
        return $this->path;
    }

    public function getDepth(): int
    {
        return $this->depth;
    }

    public function getExternalCode(): ?string
    {
        return $this->externalCode;
    }

    public function setExternalCode(?string $externalCode): void
    {
        $this->externalCode = $externalCode;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int $sortOrder): void
    {
        $this->sortOrder = $sortOrder;
    }

    /** @return Collection<int, PartCategoryAssignment> */
    public function getAssignments(): Collection
    {
        return $this->assignments;
    }

    /**
     * Recompute $path and $depth from the parent chain.
     *
     * Called by app:categories:rebuild-paths and by the importer after a tree is
     * built, parents first. Not a lifecycle callback: moving a node has to update
     * its whole subtree, which an entity cannot see on its own.
     */
    public function rebuildPath(): void
    {
        $slugs = [$this->slug];
        $node = $this->parent;
        $guard = 0;
        while (null !== $node && $guard++ < 32) {
            array_unshift($slugs, $node->getSlug());
            $node = $node->getParent();
        }

        $this->path = implode('/', $slugs);
        $this->depth = \count($slugs) - 1;
    }

    /** The BrickLink-style flattened label: "Brick, Modified, Decorated". */
    #[Groups(['part_category:read', 'catalog:summary'])]
    public function getFullName(): string
    {
        $names = [$this->name];
        $node = $this->parent;
        $guard = 0;
        while (null !== $node && $guard++ < 32) {
            array_unshift($names, $node->getName());
            $node = $node->getParent();
        }

        return implode(', ', $names);
    }
}
