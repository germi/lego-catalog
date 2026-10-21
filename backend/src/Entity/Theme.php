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
use App\Repository\ThemeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * What a set belongs to: Star Wars, and under it Ultimate Collector Series.
 *
 * Same shape as PartCategory — self-referencing parent with a materialised path — but a
 * separate table, because themes group products and categories group shapes. Nothing
 * sensible would come of merging them.
 */
#[ORM\Entity(repositoryClass: ThemeRepository::class)]
#[ORM\Table(name: 'theme')]
#[ORM\Index(name: 'idx_theme_path', columns: ['path'])]
#[ORM\Index(name: 'idx_theme_parent', columns: ['parent_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['theme:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['theme:write']],
    order: ['path' => 'ASC', 'name' => 'ASC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'parent', filter: new IriFilter(), property: 'parent')]
#[QueryParameter(key: 'depth', filter: new ExactFilter(), property: 'depth')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'path', filter: new PartialSearchFilter(), property: 'path')]
class Theme
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['theme:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['theme:read', 'theme:write'])]
    private ?self $parent = null;

    /** @var Collection<int, self> */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent')]
    #[ORM\OrderBy(['name' => 'ASC'])]
    private Collection $children;

    #[ORM\Column(length: 128)]
    #[Groups(['theme:read', 'theme:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 160)]
    #[Groups(['theme:read', 'theme:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    /** Derived, as on PartCategory: "star-wars/ultimate-collector-series". */
    #[ORM\Column(length: 512, options: ['default' => ''])]
    #[Groups(['theme:read', 'catalog:summary'])]
    private string $path = '';

    /** Derived: 0 for a root. */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['theme:read'])]
    private int $depth = 0;

    #[ORM\Column(nullable: true, unique: true)]
    #[Groups(['theme:read'])]
    private ?int $rebrickableId = null;

    /** @var Collection<int, Set> */
    #[ORM\OneToMany(targetEntity: Set::class, mappedBy: 'theme')]
    private Collection $sets;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->children = new ArrayCollection();
        $this->sets = new ArrayCollection();
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

    public function getPath(): string
    {
        return $this->path;
    }

    public function getDepth(): int
    {
        return $this->depth;
    }

    public function getRebrickableId(): ?int
    {
        return $this->rebrickableId;
    }

    public function setRebrickableId(?int $rebrickableId): void
    {
        $this->rebrickableId = $rebrickableId;
    }

    /** @return Collection<int, Set> */
    public function getSets(): Collection
    {
        return $this->sets;
    }

    /** See PartCategory::rebuildPath() — same contract, same reasons. */
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

    #[Groups(['theme:read', 'catalog:summary'])]
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
