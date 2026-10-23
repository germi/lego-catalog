<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\FreeTextQueryFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\RangeFilter;
use ApiPlatform\Doctrine\Orm\Filter\SortFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\MinifigRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A minifigure, catalogued in its own right: "sw0001".
 *
 * Not a set and not a part. It has its own inventory of elements, it appears in many
 * sets, and it is sold on its own — which is why it is its own entity rather than a
 * flag on either side.
 */
#[ORM\Entity(repositoryClass: MinifigRepository::class)]
#[ORM\Table(name: 'minifig')]
#[ORM\Index(name: 'idx_minifig_theme', columns: ['theme_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['minifig:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['minifig:write']],
    order: ['number' => 'ASC'],
    paginationItemsPerPage: 48,
    // The client decides its own page size; without this the request's itemsPerPage is
    // silently ignored and the number above wins, which makes the UI and the API disagree.
    paginationClientItemsPerPage: true,
    paginationMaximumItemsPerPage: 200,
)]
#[QueryParameter(
    key: 'q',
    filter: new FreeTextQueryFilter(new OrFilter(new PartialSearchFilter()), ['name', 'number']),
    properties: ['name', 'number'],
)]
#[QueryParameter(key: 'number', filter: new ExactFilter(), property: 'number')]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'theme', filter: new IriFilter(), property: 'theme')]
#[QueryParameter(key: 'year', filter: new RangeFilter(), property: 'yearFrom')]
#[QueryParameter(key: 'set', filter: new IriFilter(), property: 'setLines.set')]
#[QueryParameter(key: 'sort[:property]', filter: new SortFilter())]
class Minifig
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['minifig:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 32, unique: true)]
    #[Groups(['minifig:read', 'minifig:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $number;

    #[ORM\Column(length: 255)]
    #[Groups(['minifig:read', 'minifig:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\ManyToOne(targetEntity: Theme::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['minifig:read', 'minifig:write', 'catalog:summary'])]
    private ?Theme $theme = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['minifig:read', 'minifig:write'])]
    private ?int $yearFrom = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['minifig:read', 'minifig:write'])]
    private ?int $yearTo = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['minifig:read', 'catalog:summary'])]
    private int $numParts = 0;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['minifig:read', 'minifig:write', 'catalog:summary'])]
    private ?string $imageUrl = null;

    #[ORM\Column(length: 32, nullable: true, unique: true)]
    #[Groups(['minifig:read'])]
    private ?string $rebrickableId = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['minifig:read', 'minifig:write'])]
    private ?string $notes = null;

    /** @var Collection<int, MinifigElement> */
    #[ORM\OneToMany(targetEntity: MinifigElement::class, mappedBy: 'minifig', cascade: ['remove'], orphanRemoval: true)]
    private Collection $elementLines;

    /** @var Collection<int, SetMinifig> */
    #[ORM\OneToMany(targetEntity: SetMinifig::class, mappedBy: 'minifig', cascade: ['remove'], orphanRemoval: true)]
    private Collection $setLines;

    public function __construct(string $number = '', string $name = '')
    {
        $this->number = $number;
        $this->name = $name;
        $this->elementLines = new ArrayCollection();
        $this->setLines = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNumber(): string
    {
        return $this->number;
    }

    public function setNumber(string $number): void
    {
        $this->number = $number;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = mb_substr($name, 0, 255);
    }

    public function getTheme(): ?Theme
    {
        return $this->theme;
    }

    public function setTheme(?Theme $theme): void
    {
        $this->theme = $theme;
    }

    public function getYearFrom(): ?int
    {
        return $this->yearFrom;
    }

    public function setYearFrom(?int $yearFrom): void
    {
        $this->yearFrom = $yearFrom;
    }

    public function getYearTo(): ?int
    {
        return $this->yearTo;
    }

    public function setYearTo(?int $yearTo): void
    {
        $this->yearTo = $yearTo;
    }

    public function getNumParts(): int
    {
        return $this->numParts;
    }

    public function setNumParts(int $numParts): void
    {
        $this->numParts = $numParts;
    }

    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }

    public function setImageUrl(?string $imageUrl): void
    {
        $this->imageUrl = $imageUrl;
    }

    public function getRebrickableId(): ?string
    {
        return $this->rebrickableId;
    }

    public function setRebrickableId(?string $rebrickableId): void
    {
        $this->rebrickableId = $rebrickableId;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** @return Collection<int, MinifigElement> */
    public function getElementLines(): Collection
    {
        return $this->elementLines;
    }

    /** @return Collection<int, SetMinifig> */
    public function getSetLines(): Collection
    {
        return $this->setLines;
    }
}
