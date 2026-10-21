<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\SetSubsetRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A set packaged inside another set.
 *
 * Common in multi-pack and promotional boxes. Kept as its own table rather than
 * flattening the child's elements into the parent, so the parent's inventory stays
 * the truth about what is in the box rather than a derived guess.
 */
#[ORM\Entity(repositoryClass: SetSubsetRepository::class)]
#[ORM\Table(name: 'set_subset')]
#[ORM\UniqueConstraint(name: 'uniq_set_subset_line', columns: ['set_id', 'child_set_id'])]
#[ORM\Index(name: 'idx_set_subset_child', columns: ['child_set_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['set_subset:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['set_subset:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'set')]
#[QueryParameter(key: 'childSet', filter: new IriFilter(), property: 'childSet')]
class SetSubset
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['set_subset:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Set::class, inversedBy: 'subsetLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_subset:read', 'set_subset:write'])]
    private Set $set;

    #[ORM\ManyToOne(targetEntity: Set::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_subset:read', 'set_subset:write'])]
    private Set $childSet;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['set_subset:read', 'set_subset:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    public function __construct(?Set $set = null, ?Set $childSet = null, int $quantity = 1)
    {
        if (null !== $set) {
            $this->set = $set;
        }
        if (null !== $childSet) {
            $this->childSet = $childSet;
        }
        $this->quantity = $quantity;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSet(): Set
    {
        return $this->set;
    }

    public function setSet(Set $set): void
    {
        $this->set = $set;
    }

    public function getChildSet(): Set
    {
        return $this->childSet;
    }

    public function setChildSet(Set $childSet): void
    {
        $this->childSet = $childSet;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): void
    {
        $this->quantity = $quantity;
    }
}
