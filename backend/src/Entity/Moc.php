<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Doctrine\Orm\Filter\PartialSearchFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\MocRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * My Own Creation: something you designed, with its own parts list.
 *
 * Deliberately not a Set. A set is a product with a catalogue number; a MOC is a build
 * with an author. They share only the shape of having an inventory.
 *
 * "What am I missing to build this" is MocElement minus OwnedElement — a query, not a
 * stored column, so it cannot go stale.
 */
#[ORM\Entity(repositoryClass: MocRepository::class)]
#[ORM\Table(name: 'moc')]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['moc:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['moc:write']],
    order: ['createdAt' => 'DESC'],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'name', filter: new PartialSearchFilter(), property: 'name')]
#[QueryParameter(key: 'basedOnSet', filter: new IriFilter(), property: 'basedOnSet')]
class Moc
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['moc:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['moc:read', 'moc:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 160, unique: true)]
    #[Groups(['moc:read', 'moc:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    #[ORM\Column(length: 128, nullable: true)]
    #[Groups(['moc:read', 'moc:write'])]
    private ?string $author = null;

    /** Where the instructions live, if they are someone else's design. */
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['moc:read', 'moc:write'])]
    private ?string $url = null;

    /** An alternate build of an official set, when that is what it is. */
    #[ORM\ManyToOne(targetEntity: Set::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['moc:read', 'moc:write'])]
    private ?Set $basedOnSet = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['moc:read', 'moc:write', 'catalog:summary'])]
    private ?string $imageUrl = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['moc:read', 'moc:write'])]
    private ?string $notes = null;

    #[ORM\Column]
    #[Groups(['moc:read'])]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, MocElement> */
    #[ORM\OneToMany(targetEntity: MocElement::class, mappedBy: 'moc', cascade: ['remove'], orphanRemoval: true)]
    private Collection $elementLines;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->elementLines = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): void
    {
        $this->slug = $slug;
    }

    public function getAuthor(): ?string
    {
        return $this->author;
    }

    public function setAuthor(?string $author): void
    {
        $this->author = $author;
    }

    public function getUrl(): ?string
    {
        return $this->url;
    }

    public function setUrl(?string $url): void
    {
        $this->url = $url;
    }

    public function getBasedOnSet(): ?Set
    {
        return $this->basedOnSet;
    }

    public function setBasedOnSet(?Set $basedOnSet): void
    {
        $this->basedOnSet = $basedOnSet;
    }

    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }

    public function setImageUrl(?string $imageUrl): void
    {
        $this->imageUrl = $imageUrl;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, MocElement> */
    public function getElementLines(): Collection
    {
        return $this->elementLines;
    }
}
