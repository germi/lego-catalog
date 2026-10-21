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
use App\Repository\SetMinifigRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/** How many of a minifigure a set contains. */
#[ORM\Entity(repositoryClass: SetMinifigRepository::class)]
#[ORM\Table(name: 'set_minifig')]
#[ORM\UniqueConstraint(name: 'uniq_set_minifig_line', columns: ['set_id', 'minifig_id', 'role'])]
#[ORM\Index(name: 'idx_set_minifig_minifig', columns: ['minifig_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['set_minifig:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['set_minifig:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'set')]
#[QueryParameter(key: 'minifig', filter: new IriFilter(), property: 'minifig')]
#[QueryParameter(key: 'role', filter: new BackedEnumFilter(), property: 'role')]
class SetMinifig
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['set_minifig:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Set::class, inversedBy: 'minifigLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_minifig:read', 'set_minifig:write'])]
    private Set $set;

    #[ORM\ManyToOne(targetEntity: Minifig::class, inversedBy: 'setLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['set_minifig:read', 'set_minifig:write'])]
    private Minifig $minifig;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['set_minifig:read', 'set_minifig:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    #[ORM\Column(enumType: InventoryRole::class, options: ['default' => 'regular'])]
    #[Groups(['set_minifig:read', 'set_minifig:write'])]
    private InventoryRole $role = InventoryRole::Regular;

    public function __construct(?Set $set = null, ?Minifig $minifig = null, int $quantity = 1)
    {
        if (null !== $set) {
            $this->set = $set;
        }
        if (null !== $minifig) {
            $this->minifig = $minifig;
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

    public function getMinifig(): Minifig
    {
        return $this->minifig;
    }

    public function setMinifig(Minifig $minifig): void
    {
        $this->minifig = $minifig;
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
