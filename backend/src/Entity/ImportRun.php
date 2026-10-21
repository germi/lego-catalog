<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Enum\ImportStatus;
use App\Repository\ImportRunRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * One run of a catalogue import.
 *
 * Kept so a re-import is diffable: what was fetched, when, how many rows of each kind
 * were created or updated, and what blew up. Read-only over the API — runs are created
 * by the import command, never by a client.
 */
#[ORM\Entity(repositoryClass: ImportRunRepository::class)]
#[ORM\Table(name: 'import_run')]
#[ApiResource(
    operations: [new GetCollection(), new Get()],
    normalizationContext: ['groups' => ['import_run:read']],
    order: ['startedAt' => 'DESC'],
    paginationItemsPerPage: 30,
)]
class ImportRun
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['import_run:read'])]
    private ?int $id = null;

    /** "rebrickable" today; another source would add its own value. */
    #[ORM\Column(length: 32)]
    #[Groups(['import_run:read'])]
    private string $source;

    #[ORM\Column(enumType: ImportStatus::class, options: ['default' => 'running'])]
    #[Groups(['import_run:read'])]
    private ImportStatus $status = ImportStatus::Running;

    #[ORM\Column]
    #[Groups(['import_run:read'])]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['import_run:read'])]
    private ?\DateTimeImmutable $finishedAt = null;

    /**
     * Row counts per table, as {"parts": {"created": 12, "updated": 3}, …}.
     *
     * JSON rather than a column each: the shape follows whatever the source publishes,
     * and this is a log to read, not something to query.
     *
     * @var array<string, array<string, int>>
     */
    #[ORM\Column(type: Types::JSON)]
    #[Groups(['import_run:read'])]
    private array $counts = [];

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['import_run:read'])]
    private ?string $error = null;

    public function __construct(string $source = 'rebrickable')
    {
        $this->source = $source;
        $this->startedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function getStatus(): ImportStatus
    {
        return $this->status;
    }

    public function setStatus(ImportStatus $status): void
    {
        $this->status = $status;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getFinishedAt(): ?\DateTimeImmutable
    {
        return $this->finishedAt;
    }

    public function finish(ImportStatus $status, ?string $error = null): void
    {
        $this->status = $status;
        $this->error = $error;
        $this->finishedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /** @return array<string, array<string, int>> */
    public function getCounts(): array
    {
        return $this->counts;
    }

    /** @param array<string, array<string, int>> $counts */
    public function setCounts(array $counts): void
    {
        $this->counts = $counts;
    }

    public function getError(): ?string
    {
        return $this->error;
    }
}
