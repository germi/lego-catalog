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
use App\Enum\ElementCodeSource;
use App\Repository\ElementCodeRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * One of the numbers that identify an element.
 *
 * LEGO prints a seven-digit element ID in the back of the instruction booklet, and it
 * reissues the same shape-and-colour under a new one every so often: 300121 and 4211385
 * are both the red 2 x 4. So this is one-to-many, and one row per element is flagged
 * primary for the places that can only show a single number.
 */
#[ORM\Entity(repositoryClass: ElementCodeRepository::class)]
#[ORM\Table(name: 'element_code')]
#[ORM\UniqueConstraint(name: 'uniq_element_code_code_source', columns: ['code', 'source'])]
#[ORM\Index(name: 'idx_element_code_element', columns: ['element_id'])]
#[ApiResource(
    operations: [new GetCollection(), new Get(), new Post(), new Delete()],
    normalizationContext: ['groups' => ['element_code:read', 'catalog:summary']],
    denormalizationContext: ['groups' => ['element_code:write']],
    paginationEnabled: false,
)]
#[QueryParameter(key: 'element', filter: new IriFilter(), property: 'element')]
#[QueryParameter(key: 'code', filter: new ExactFilter(), property: 'code')]
class ElementCode
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['element_code:read', 'element:read', 'catalog:summary'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Element::class, inversedBy: 'codes')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['element_code:read', 'element_code:write'])]
    private Element $element;

    #[ORM\Column(length: 32)]
    #[Groups(['element_code:read', 'element_code:write', 'element:read', 'catalog:summary'])]
    #[Assert\NotBlank]
    private string $code;

    #[ORM\Column(enumType: ElementCodeSource::class)]
    #[Groups(['element_code:read', 'element_code:write', 'element:read', 'catalog:summary'])]
    private ElementCodeSource $source = ElementCodeSource::LegoElementId;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['element_code:read', 'element_code:write', 'element:read'])]
    private bool $isPrimary = false;

    public function __construct(?Element $element = null, string $code = '', ElementCodeSource $source = ElementCodeSource::LegoElementId)
    {
        if (null !== $element) {
            $this->element = $element;
        }
        $this->code = $code;
        $this->source = $source;
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getSource(): ElementCodeSource
    {
        return $this->source;
    }

    public function setSource(ElementCodeSource $source): void
    {
        $this->source = $source;
    }

    public function isPrimary(): bool
    {
        return $this->isPrimary;
    }

    public function setIsPrimary(bool $isPrimary): void
    {
        $this->isPrimary = $isPrimary;
    }
}
