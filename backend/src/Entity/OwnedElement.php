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
use App\Repository\OwnedElementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * How many of an element you have, and where it is.
 *
 * One row per (element, condition, location): the same piece can sit in two bins, and
 * new and used are worth counting apart. The location is required — unfiled pieces go
 * to the "unsorted" sentinel — so the unique constraint actually holds.
 */
#[ORM\Entity(repositoryClass: OwnedElementRepository::class)]
#[ORM\Table(name: 'owned_element')]
#[ORM\UniqueConstraint(name: 'uniq_owned_element_holding', columns: ['element_id', 'item_condition', 'storage_location_id'])]
#[ORM\Index(name: 'idx_owned_element_location', columns: ['storage_location_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['owned_element:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['owned_element:write']],
    paginationItemsPerPage: 100,
)]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'element.part')]
#[QueryParameter(key: 'color', filter: new IriFilter(), property: 'element.color')]
#[QueryParameter(key: 'storageLocation', filter: new IriFilter(), property: 'storageLocation')]
#[QueryParameter(key: 'condition', filter: new BackedEnumFilter(), property: 'condition')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class OwnedElement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['owned_element:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['owned_element:read', 'owned_element:write'])]
    private Element $element;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['owned_element:read', 'owned_element:write'])]
    #[Assert\PositiveOrZero]
    private int $quantity = 0;

    /** Column is item_condition: CONDITION is a reserved word in MySQL. */
    #[ORM\Column(name: 'item_condition', enumType: ItemCondition::class, options: ['default' => 'used'])]
    #[Groups(['owned_element:read', 'owned_element:write'])]
    private ItemCondition $condition = ItemCondition::Used;

    #[ORM\ManyToOne(targetEntity: StorageLocation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'RESTRICT')]
    #[Groups(['owned_element:read', 'owned_element:write'])]
    private StorageLocation $storageLocation;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['owned_element:read', 'owned_element:write'])]
    private ?string $notes = null;

    #[ORM\Column]
    #[Groups(['owned_element:read'])]
    private \DateTimeImmutable $updatedAt;

    public function __construct(?Element $element = null, ?StorageLocation $storageLocation = null, int $quantity = 0)
    {
        if (null !== $element) {
            $this->element = $element;
        }
        if (null !== $storageLocation) {
            $this->storageLocation = $storageLocation;
        }
        $this->quantity = $quantity;
        $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int
    {
        return $this->id;
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
        $this->touch();
    }

    public function getCondition(): ItemCondition
    {
        return $this->condition;
    }

    public function setCondition(ItemCondition $condition): void
    {
        $this->condition = $condition;
    }

    public function getStorageLocation(): StorageLocation
    {
        return $this->storageLocation;
    }

    public function setStorageLocation(StorageLocation $storageLocation): void
    {
        $this->storageLocation = $storageLocation;
        $this->touch();
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }
}
