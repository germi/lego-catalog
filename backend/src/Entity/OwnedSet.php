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
use App\Enum\ItemCondition;
use App\Enum\SetCompleteness;
use App\Repository\OwnedSetRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A copy of a set that you have.
 *
 * One row is one holding, not one fact about a set: two used copies in different states
 * are two rows, so there is deliberately no unique constraint here.
 *
 * $pricePaid is FLOAT for the same reason as everywhere else in this schema — Doctrine
 * maps DECIMAL to a PHP string and the Serializer then rejects a JSON number on write.
 */
#[ORM\Entity(repositoryClass: OwnedSetRepository::class)]
#[ORM\Table(name: 'owned_set')]
#[ORM\Index(name: 'idx_owned_set_set', columns: ['set_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['owned_set:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['owned_set:write']],
    order: ['acquiredOn' => 'DESC'],
    paginationItemsPerPage: 48,
)]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'set')]
#[QueryParameter(key: 'theme', filter: new IriFilter(), property: 'set.theme')]
#[QueryParameter(key: 'condition', filter: new BackedEnumFilter(), property: 'condition')]
#[QueryParameter(key: 'completeness', filter: new BackedEnumFilter(), property: 'completeness')]
#[QueryParameter(key: 'storageLocation', filter: new IriFilter(), property: 'storageLocation')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class OwnedSet
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['owned_set:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Set::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private Set $set;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    #[ORM\Column(name: 'item_condition', enumType: ItemCondition::class, options: ['default' => 'used'])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private ItemCondition $condition = ItemCondition::Used;

    #[ORM\Column(enumType: SetCompleteness::class, options: ['default' => 'unknown'])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private SetCompleteness $completeness = SetCompleteness::Unknown;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private bool $hasBox = false;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private bool $hasInstructions = false;

    /** True while it is standing built on a shelf rather than back in the bin. */
    #[ORM\Column(options: ['default' => false])]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private bool $isBuilt = false;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private ?\DateTimeImmutable $acquiredOn = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    #[Assert\PositiveOrZero]
    private ?float $pricePaid = null;

    #[ORM\Column(length: 8, nullable: true)]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private ?string $currency = null;

    #[ORM\ManyToOne(targetEntity: StorageLocation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private ?StorageLocation $storageLocation = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['owned_set:read', 'owned_set:write'])]
    private ?string $notes = null;

    public function __construct(?Set $set = null)
    {
        if (null !== $set) {
            $this->set = $set;
        }
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

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): void
    {
        $this->quantity = $quantity;
    }

    public function getCondition(): ItemCondition
    {
        return $this->condition;
    }

    public function setCondition(ItemCondition $condition): void
    {
        $this->condition = $condition;
    }

    public function getCompleteness(): SetCompleteness
    {
        return $this->completeness;
    }

    public function setCompleteness(SetCompleteness $completeness): void
    {
        $this->completeness = $completeness;
    }

    public function hasBox(): bool
    {
        return $this->hasBox;
    }

    public function setHasBox(bool $hasBox): void
    {
        $this->hasBox = $hasBox;
    }

    public function hasInstructions(): bool
    {
        return $this->hasInstructions;
    }

    public function setHasInstructions(bool $hasInstructions): void
    {
        $this->hasInstructions = $hasInstructions;
    }

    public function isBuilt(): bool
    {
        return $this->isBuilt;
    }

    public function setIsBuilt(bool $isBuilt): void
    {
        $this->isBuilt = $isBuilt;
    }

    public function getAcquiredOn(): ?\DateTimeImmutable
    {
        return $this->acquiredOn;
    }

    public function setAcquiredOn(?\DateTimeImmutable $acquiredOn): void
    {
        $this->acquiredOn = $acquiredOn;
    }

    public function getPricePaid(): ?float
    {
        return $this->pricePaid;
    }

    public function setPricePaid(?float $pricePaid): void
    {
        $this->pricePaid = null === $pricePaid ? null : round($pricePaid, 2);
    }

    public function getCurrency(): ?string
    {
        return $this->currency;
    }

    public function setCurrency(?string $currency): void
    {
        $this->currency = $currency;
    }

    public function getStorageLocation(): ?StorageLocation
    {
        return $this->storageLocation;
    }

    public function setStorageLocation(?StorageLocation $storageLocation): void
    {
        $this->storageLocation = $storageLocation;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }
}
