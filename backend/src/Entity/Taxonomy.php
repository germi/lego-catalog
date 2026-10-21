<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\TaxonomySource;
use App\Repository\TaxonomyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * One way of classifying parts.
 *
 * There is no single right category tree, which is the whole reason this table exists.
 * BrickLink files a 1 x 2 brick with side studs under "Brick, Modified"; Brick Architect
 * calls it SNOT, because that is what you reach for it to do; Rebrickable has its own
 * flat list of about sixty-five. All three are useful and none subsumes the others, so
 * a part gets at most one category per taxonomy and can sit in every taxonomy at once.
 *
 * Exactly one taxonomy is the default: it decides what the parts list shows when nobody
 * has chosen, and which category lands in Part::$primaryCategory.
 */
#[ORM\Entity(repositoryClass: TaxonomyRepository::class)]
#[ORM\Table(name: 'taxonomy')]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch()],
    normalizationContext: ['groups' => ['taxonomy:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['taxonomy:write']],
    order: ['name' => 'ASC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'source', filter: new BackedEnumFilter(), property: 'source')]
class Taxonomy
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['taxonomy:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 128)]
    #[Groups(['taxonomy:read', 'taxonomy:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 64, unique: true)]
    #[Groups(['taxonomy:read', 'taxonomy:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    #[ORM\Column(enumType: TaxonomySource::class)]
    #[Groups(['taxonomy:read', 'taxonomy:write', 'catalog:summary'])]
    private TaxonomySource $source = TaxonomySource::Custom;

    /** Only one row should carry this; the repository enforces it on write. */
    #[ORM\Column(options: ['default' => false])]
    #[Groups(['taxonomy:read', 'taxonomy:write'])]
    private bool $isDefault = false;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['taxonomy:read', 'taxonomy:write'])]
    private ?string $description = null;

    /** @var Collection<int, PartCategory> */
    #[ORM\OneToMany(targetEntity: PartCategory::class, mappedBy: 'taxonomy', cascade: ['remove'], orphanRemoval: true)]
    private Collection $categories;

    public function __construct(string $name = '', string $slug = '', TaxonomySource $source = TaxonomySource::Custom)
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->source = $source;
        $this->categories = new ArrayCollection();
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

    public function getSource(): TaxonomySource
    {
        return $this->source;
    }

    public function setSource(TaxonomySource $source): void
    {
        $this->source = $source;
    }

    public function isDefault(): bool
    {
        return $this->isDefault;
    }

    public function setIsDefault(bool $isDefault): void
    {
        $this->isDefault = $isDefault;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    /** @return Collection<int, PartCategory> */
    public function getCategories(): Collection
    {
        return $this->categories;
    }
}
