<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\WantedListRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A named wanted list.
 *
 * The class is WantedList and not List, which is a reserved word in PHP — the same
 * trap that made the price tracker's lists ProductList.
 */
#[ORM\Entity(repositoryClass: WantedListRepository::class)]
#[ORM\Table(name: 'wanted_list')]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['wanted_list:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['wanted_list:write']],
    order: ['name' => 'ASC'],
    paginationEnabled: false,
)]
class WantedList
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['wanted_list:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 128)]
    #[Groups(['wanted_list:read', 'wanted_list:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 160, unique: true)]
    #[Groups(['wanted_list:read', 'wanted_list:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['wanted_list:read', 'wanted_list:write'])]
    private ?string $notes = null;

    #[ORM\Column]
    #[Groups(['wanted_list:read'])]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, WantedLine> */
    #[ORM\OneToMany(targetEntity: WantedLine::class, mappedBy: 'list', cascade: ['remove'], orphanRemoval: true)]
    private Collection $lines;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->lines = new ArrayCollection();
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

    /** @return Collection<int, WantedLine> */
    public function getLines(): Collection
    {
        return $this->lines;
    }

    #[Groups(['wanted_list:read'])]
    public function getLineCount(): int
    {
        return $this->lines->count();
    }
}
