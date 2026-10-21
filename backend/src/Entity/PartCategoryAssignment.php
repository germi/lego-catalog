<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\PartCategoryAssignmentRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Files one part under one category of one taxonomy.
 *
 * $taxonomy duplicates $category->getTaxonomy() so that the database itself can hold
 * the rule "at most one category per part per taxonomy" in a unique constraint. It is
 * kept in step by setCategory(); nothing else should write it.
 */
#[ORM\Entity(repositoryClass: PartCategoryAssignmentRepository::class)]
#[ORM\Table(name: 'part_category_assignment')]
#[ORM\UniqueConstraint(name: 'uniq_assignment_part_taxonomy', columns: ['part_id', 'taxonomy_id'])]
#[ORM\Index(name: 'idx_assignment_category', columns: ['category_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Delete()],
    normalizationContext: ['groups' => ['part_category_assignment:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['part_category_assignment:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'part')]
#[QueryParameter(key: 'category', filter: new IriFilter(), property: 'category')]
#[QueryParameter(key: 'taxonomy', filter: new IriFilter(), property: 'taxonomy')]
class PartCategoryAssignment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['part_category_assignment:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Part::class, inversedBy: 'categoryAssignments')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_category_assignment:read', 'part_category_assignment:write'])]
    private Part $part;

    #[ORM\ManyToOne(targetEntity: PartCategory::class, inversedBy: 'assignments')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_category_assignment:read', 'part_category_assignment:write', 'part:read'])]
    private PartCategory $category;

    /** Denormalised from the category, so the unique constraint can exist. */
    #[ORM\ManyToOne(targetEntity: Taxonomy::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_category_assignment:read'])]
    private Taxonomy $taxonomy;

    public function __construct(?Part $part = null, ?PartCategory $category = null)
    {
        if (null !== $part) {
            $this->part = $part;
        }
        if (null !== $category) {
            $this->setCategory($category);
        }
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

    public function getCategory(): PartCategory
    {
        return $this->category;
    }

    public function setCategory(PartCategory $category): void
    {
        $this->category = $category;
        $this->taxonomy = $category->getTaxonomy();
    }

    public function getTaxonomy(): Taxonomy
    {
        return $this->taxonomy;
    }
}
