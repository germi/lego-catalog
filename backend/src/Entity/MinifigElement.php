<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BackedEnumFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\InventoryRole;
use App\Repository\MinifigElementRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/** One line of a minifigure's own inventory. Same shape as SetElement. */
#[ORM\Entity(repositoryClass: MinifigElementRepository::class)]
#[ORM\Table(name: 'minifig_element')]
#[ORM\UniqueConstraint(name: 'uniq_minifig_element_line', columns: ['minifig_id', 'element_id', 'role'])]
#[ORM\Index(name: 'idx_minifig_element_element', columns: ['element_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['minifig_element:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['minifig_element:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'minifig', filter: new IriFilter(), property: 'minifig')]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
#[QueryParameter(key: 'role', filter: new BackedEnumFilter(), property: 'role')]
class MinifigElement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['minifig_element:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Minifig::class, inversedBy: 'elementLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['minifig_element:read', 'minifig_element:write'])]
    private Minifig $minifig;

    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['minifig_element:read', 'minifig_element:write'])]
    private Element $element;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['minifig_element:read', 'minifig_element:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    #[ORM\Column(enumType: InventoryRole::class, options: ['default' => 'regular'])]
    #[Groups(['minifig_element:read', 'minifig_element:write'])]
    private InventoryRole $role = InventoryRole::Regular;

    public function __construct(?Minifig $minifig = null, ?Element $element = null, int $quantity = 1)
    {
        if (null !== $minifig) {
            $this->minifig = $minifig;
        }
        if (null !== $element) {
            $this->element = $element;
        }
        $this->quantity = $quantity;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getMinifig(): Minifig
    {
        return $this->minifig;
    }

    public function setMinifig(Minifig $minifig): void
    {
        $this->minifig = $minifig;
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
}
