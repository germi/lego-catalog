<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\ColorFamilyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * A hue group: Blue, Green, Brown, Gray…
 *
 * BrickLink's colour guide filters by exactly these — eleven of them — and they are
 * the axis people actually browse by. A colour belongs to one family; the finish
 * (transparent, chrome, pearl…) is a separate field on Color, not a family.
 */
#[ORM\Entity(repositoryClass: ColorFamilyRepository::class)]
#[ORM\Table(name: 'color_family')]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch()],
    normalizationContext: ['groups' => ['color_family:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['color_family:write']],
    order: ['sortOrder' => 'ASC', 'name' => 'ASC'],
    paginationEnabled: false,
)]
class ColorFamily
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['color_family:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\Column(length: 64, unique: true)]
    #[Groups(['color_family:read', 'color_family:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $name;

    #[ORM\Column(length: 64, unique: true)]
    #[Groups(['color_family:read', 'color_family:write', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $slug;

    /** A representative swatch for the family chip in the UI, "#RRGGBB". */
    #[ORM\Column(length: 7, nullable: true)]
    #[Groups(['color_family:read', 'color_family:write', 'catalog:summary'])]
    private ?string $swatchHex = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['color_family:read', 'color_family:write'])]
    private int $sortOrder = 0;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['color_family:read', 'color_family:write'])]
    private ?string $notes = null;

    /** @var Collection<int, Color> */
    #[ORM\OneToMany(targetEntity: Color::class, mappedBy: 'family')]
    #[ORM\OrderBy(['name' => 'ASC'])]
    private Collection $colors;

    public function __construct(string $name = '', string $slug = '')
    {
        $this->name = $name;
        $this->slug = $slug;
        $this->colors = new ArrayCollection();
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

    public function getSwatchHex(): ?string
    {
        return $this->swatchHex;
    }

    public function setSwatchHex(?string $swatchHex): void
    {
        $this->swatchHex = $swatchHex;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int $sortOrder): void
    {
        $this->sortOrder = $sortOrder;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /** @return Collection<int, Color> */
    public function getColors(): Collection
    {
        return $this->colors;
    }

    #[Groups(['color_family:read'])]
    public function getColorCount(): int
    {
        return $this->colors->count();
    }
}
