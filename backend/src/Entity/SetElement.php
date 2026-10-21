<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\InventoryRole;
use App\Repository\SetElementRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * One line of a set's inventory: this element, this many times.
 *
 * The "x5, x6" of a parts list. The line points at an Element and not a Part, because
 * a quantity is only meaningful once the colour is known.
 *
 * $matchGroup is BrickLink's match ID. Regular lines sit in group 0; an alternate line
 * carries the same non-zero group as the regular line it can stand in for, which is the
 * only way to express "this kit shipped either of these two" without inventing a second
 * inventory. It defaults to 0 rather than being nullable so the unique constraint keeps
 * working — MySQL treats every NULL as distinct.
 */
#[ORM\Entity(repositoryClass: SetElementRepository::class)]
#[ORM\Table(name: 'set_element')]
#[ORM\UniqueConstraint(name: 'uniq_set_element_line', columns: ['set_id', 'element_id', 'role', 'match_group'])]
#[ORM\Index(name: 'idx_set_element_element', columns: ['element_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['set_element:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['set_element:write']],
    paginationItemsPerPage: 200,
)]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'set')]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'element.part')]
#[QueryParameter(key: 'color', filter: new IriFilter(), property: 'element.color')]
#[QueryParameter(key: 'role', filter: new BackedEnumFilter(), property: 'role')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class SetElement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['set_element:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Set::class, inversedBy: 'elementLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_element:read', 'set_element:write'])]
    private Set $set;

    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_element:read', 'set_element:write'])]
    private Element $element;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['set_element:read', 'set_element:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    #[ORM\Column(enumType: InventoryRole::class, options: ['default' => 'regular'])]
    #[Groups(['set_element:read', 'set_element:write'])]
    private InventoryRole $role = InventoryRole::Regular;

    /** BrickLink's match ID; 0 for a plain regular line. */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['set_element:read', 'set_element:write'])]
    #[Assert\PositiveOrZero]
    private int $matchGroup = 0;

    public function __construct(?Set $set = null, ?Element $element = null, int $quantity = 1, InventoryRole $role = InventoryRole::Regular)
    {
        if (null !== $set) {
            $this->set = $set;
        }
        if (null !== $element) {
            $this->element = $element;
        }
        $this->quantity = $quantity;
        $this->role = $role;
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

    public function getElement(): Element
    {
        return $this->element;
    }

    public function setElement(Element $element): void
    {
        $this->element = $element;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): void
    {
        $this->quantity = $quantity;
    }

    public function getRole(): InventoryRole
    {
        return $this->role;
    }

    public function setRole(InventoryRole $role): void
    {
        $this->role = $role;
    }

    public function getMatchGroup(): int
    {
        return $this->matchGroup;
    }

    public function setMatchGroup(int $matchGroup): void
    {
        $this->matchGroup = $matchGroup;
    }
}
