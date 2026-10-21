<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Repository\MocElementRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/** One line of a MOC's parts list. */
#[ORM\Entity(repositoryClass: MocElementRepository::class)]
#[ORM\Table(name: 'moc_element')]
#[ORM\UniqueConstraint(name: 'uniq_moc_element_line', columns: ['moc_id', 'element_id'])]
#[ORM\Index(name: 'idx_moc_element_element', columns: ['element_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Patch(), new Delete()],
    normalizationContext: ['groups' => ['moc_element:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['moc_element:write']],
    paginationItemsPerPage: 200,
)]
#[QueryParameter(key: 'moc', filter: new IriFilter(), property: 'moc')]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
class MocElement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['moc_element:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Moc::class, inversedBy: 'elementLines')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['moc_element:read', 'moc_element:write'])]
    private Moc $moc;

    #[ORM\ManyToOne(targetEntity: Element::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['moc_element:read', 'moc_element:write'])]
    private Element $element;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['moc_element:read', 'moc_element:write'])]
    #[Assert\Positive]
    private int $quantity = 1;

    public function __construct(?Moc $moc = null, ?Element $element = null, int $quantity = 1)
    {
        if (null !== $moc) {
            $this->moc = $moc;
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

    public function getMoc(): Moc
    {
        return $this->moc;
    }

    public function setMoc(Moc $moc): void
    {
        $this->moc = $moc;
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
}
