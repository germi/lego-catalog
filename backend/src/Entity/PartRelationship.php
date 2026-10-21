<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\PartRelationType;
use App\Repository\PartRelationshipRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * A typed, directed edge between two shapes.
 *
 * Parent is the plainer or the whole one: the plain head is the parent of the printed
 * head, the assembled door is the parent of its sub-parts. This one table carries every
 * relation the catalogues record — print, pattern, mould variant, left/right pair,
 * alternate, sub-part — because they are all "these two shapes are related, thus".
 *
 * Sub-part edges deliberately carry no quantity. A quantity would only be meaningful
 * per colour, which is an element-level fact; if assemblies ever need counting, that
 * belongs in its own table keyed on Element, not here.
 */
#[ORM\Entity(repositoryClass: PartRelationshipRepository::class)]
#[ORM\Table(name: 'part_relationship')]
#[ORM\UniqueConstraint(name: 'uniq_part_relationship', columns: ['parent_part_id', 'child_part_id', 'type'])]
#[ORM\Index(name: 'idx_part_relationship_child', columns: ['child_part_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Delete()],
    normalizationContext: ['groups' => ['part_relationship:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['part_relationship:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'type', filter: new BackedEnumFilter(), property: 'type')]
#[QueryParameter(key: 'parentPart', filter: new IriFilter(), property: 'parentPart')]
#[QueryParameter(key: 'childPart', filter: new IriFilter(), property: 'childPart')]
class PartRelationship
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['part_relationship:read'])]
    private ?int $id = null;

    /** The plainer or whole shape. */
    #[ORM\ManyToOne(targetEntity: Part::class, inversedBy: 'childRelationships')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_relationship:read', 'part_relationship:write'])]
    private Part $parentPart;

    #[ORM\ManyToOne(targetEntity: Part::class, inversedBy: 'parentRelationships')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_relationship:read', 'part_relationship:write'])]
    private Part $childPart;

    #[ORM\Column(enumType: PartRelationType::class)]
    #[Groups(['part_relationship:read', 'part_relationship:write'])]
    private PartRelationType $type;

    public function __construct(?Part $parentPart = null, ?Part $childPart = null, PartRelationType $type = PartRelationType::Alternate)
    {
        if (null !== $parentPart) {
            $this->parentPart = $parentPart;
        }
        if (null !== $childPart) {
            $this->childPart = $childPart;
        }
        $this->type = $type;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getParentPart(): Part
    {
        return $this->parentPart;
    }

    public function setParentPart(Part $parentPart): void
    {
        $this->parentPart = $parentPart;
    }

    public function getChildPart(): Part
    {
        return $this->childPart;
    }

    public function setChildPart(Part $childPart): void
    {
        $this->childPart = $childPart;
    }

    public function getType(): PartRelationType
    {
        return $this->type;
    }

    public function setType(PartRelationType $type): void
    {
        $this->type = $type;
    }
}
