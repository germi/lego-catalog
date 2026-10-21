<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\ExactFilter;
use ApiPlatform\Doctrine\Orm\Filter\IriFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use App\Enum\PartNumberSource;
use App\Repository\PartNumberRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Another number the same shape answers to.
 *
 * Part 3001 is also 3001f1, 3556, 15589, 54534 and 72841, plus every LEGO design ID
 * ever moulded on it. LEGO reuses and retires numbers, and the catalogues each kept
 * their own, so "search by whatever is printed on the brick" needs all of them in one
 * indexed place rather than spread across columns.
 */
#[ORM\Entity(repositoryClass: PartNumberRepository::class)]
#[ORM\Table(name: 'part_number')]
#[ORM\UniqueConstraint(name: 'uniq_part_number_number_source', columns: ['number', 'source'])]
#[ORM\Index(name: 'idx_part_number_part', columns: ['part_id'])]
#[ORM\Index(name: 'idx_part_number_number', columns: ['number'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Delete()],
    normalizationContext: ['groups' => ['part_number:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['part_number:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'part', filter: new IriFilter(), property: 'part')]
#[QueryParameter(key: 'number', filter: new ExactFilter(), property: 'number')]
class PartNumber
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['part_number:read', 'part:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Part::class, inversedBy: 'numbers')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['part_number:read', 'part_number:write'])]
    private Part $part;

    #[ORM\Column(length: 64)]
    #[Groups(['part_number:read', 'part_number:write', 'part:read'])]
    #[Assert\NotBlank]
    private string $number;

    #[ORM\Column(enumType: PartNumberSource::class)]
    #[Groups(['part_number:read', 'part_number:write', 'part:read'])]
    private PartNumberSource $source = PartNumberSource::Other;

    public function __construct(?Part $part = null, string $number = '', PartNumberSource $source = PartNumberSource::Other)
    {
        if (null !== $part) {
            $this->part = $part;
        }
        $this->number = $number;
        $this->source = $source;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPart(): Part
    {
        return $this->part;
    }

    public function setPart(Part $part): void
    {
        $this->part = $part;
    }

    public function getNumber(): string
    {
        return $this->number;
    }

    public function setNumber(string $number): void
    {
        $this->number = $number;
    }

    public function getSource(): PartNumberSource
    {
        return $this->source;
    }

    public function setSource(PartNumberSource $source): void
    {
        $this->source = $source;
    }
}
