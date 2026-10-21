<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\WantedLineRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

/**
 * One thing you are after: an element, a set, or a minifigure.
 *
 * Three nullable pointers with exactly one filled, rather than three near-identical
 * tables, because this is one list in the UI and a line's kind is not worth a join to
 * discover. "Exactly one" is a CHECK constraint in the migration — MySQL 8 enforces
 * those — and a validator callback so the API fails with a readable message rather
 * than a driver error.
 */
#[ORM\Entity(repositoryClass: WantedLineRepository::class)]
#[ORM\Table(name: 'wanted_line')]
#[ORM\Index(name: 'idx_wanted_line_list', columns: ['list_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['wanted_line:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['wanted_line:write']],
    order: ['priority' => 'DESC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'list', filter: new IriFilter(), property: 'list')]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'set')]
#[QueryParameter(key: 'minifig', filter: new IriFilter(), property: 'minifig')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
#[Assert\Callback('validateExactlyOneTarget')]
class WantedLine
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['wanted_line:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: WantedList::class, inversedBy: 'lines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private WantedList $list;

    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private ?Element $element = null;

    #[ORM\ManyToOne(targetEntity: Set::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private ?Set $set = null;

    #[ORM\ManyToOne(targetEntity: Minifig::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private ?Minifig $minifig = null;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    /** Higher sorts first. */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private int $priority = 0;

    /** Don't pay more than this. FLOAT, as every other amount here. */
    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    #[Assert\PositiveOrZero]
    private ?float $maxPrice = null;

    #[ORM\Column(length: 8, nullable: true)]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private ?string $currency = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['wanted_line:read', 'wanted_line:write'])]
    private ?string $notes = null;

    public function __construct(?WantedList $list = null)
    {
        if (null !== $list) {
            $this->list = $list;
        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getList(): WantedList
    {
        return $this->list;
    }

    public function setList(WantedList $list): void
    {
        $this->list = $list;
    }

    public function getElement(): ?Element
    {
        return $this->element;
    }

    public function setElement(?Element $element): void
    {
        $this->element = $element;
    }

    public function getSet(): ?Set
    {
        return $this->set;
    }

    public function setSet(?Set $set): void
    {
        $this->set = $set;
    }

    public function getMinifig(): ?Minifig
    {
        return $this->minifig;
    }

    public function setMinifig(?Minifig $minifig): void
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

    public function getPriority(): int
    {
        return $this->priority;
    }

    public function setPriority(int $priority): void
    {
        $this->priority = $priority;
    }

    public function getMaxPrice(): ?float
    {
        return $this->maxPrice;
    }

    public function setMaxPrice(?float $maxPrice): void
    {
        $this->maxPrice = null === $maxPrice ? null : round($maxPrice, 2);
    }

    public function getCurrency(): ?string
    {
        return $this->currency;
    }

    public function setCurrency(?string $currency): void
    {
        $this->currency = $currency;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** "element", "set" or "minifig" — saves the frontend from sniffing three fields. */
    #[Groups(['wanted_line:read', 'catalog:summary'])]
    public function getTargetType(): ?string
    {
        if (null !== $this->element) {
            return 'element';
        }
        if (null !== $this->set) {
            return 'set';
        }
        if (null !== $this->minifig) {
            return 'minifig';
        }

        return null;
    }

    public function validateExactlyOneTarget(ExecutionContextInterface $context): void
    {
        $filled = \count(array_filter([$this->element, $this->set, $this->minifig]));
        if (1 !== $filled) {
            $context->buildViolation('A wanted line must point at exactly one of element, set or minifig.')
                ->atPath('element')
                ->addViolation();
        }
    }
}
