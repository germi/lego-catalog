<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\ImportRun;
use App\Enum\ImportStatus;
use App\Import\RebrickableImporter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Loads the catalogue from Rebrickable's published CSV dumps.
 *
 * Every run is recorded as an ImportRun, including a failed one, so that a re-import is
 * diffable and a crash leaves a trace rather than a silence.
 */
#[AsCommand(
    name: 'app:import:rebrickable',
    description: 'Import colours, parts, elements, themes, sets and minifigures from the Rebrickable dumps',
)]
final class ImportRebrickableCommand extends Command
{
    public function __construct(
        private readonly RebrickableImporter $importer,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('stage', null, InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'Run only these stages, in order. Default: all of '.implode(', ', RebrickableImporter::stages()))
            ->addOption('max-age', null, InputOption::VALUE_REQUIRED,
                'Reuse a cached dump younger than this many seconds', '86400')
            ->addOption('force-download', null, InputOption::VALUE_NONE,
                'Re-download every dump even if the cached copy is fresh');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        /** @var list<string> $stages */
        $stages = $input->getOption('stage');
        if ([] === $stages) {
            $stages = RebrickableImporter::stages();
        }
        $unknown = array_diff($stages, RebrickableImporter::stages());
        if ([] !== $unknown) {
            $io->error(\sprintf('Unknown stage(s): %s. Known: %s.', implode(', ', $unknown), implode(', ', RebrickableImporter::stages())));

            return Command::INVALID;
        }

        $run = new ImportRun('rebrickable');
        $this->em->persist($run);
        $this->em->flush();

        $io->title('Importing from Rebrickable');
        $io->writeln(\sprintf('Run #%d, stages: %s', $run->getId(), implode(', ', $stages)));

        $started = microtime(true);
        $progress = function (string $stage, ?int $rows) use ($io): void {
            if (null === $rows) {
                $io->writeln(\sprintf('  <info>%s</info>', $stage));

                return;
            }
            $io->writeln(\sprintf('    %s rows', number_format($rows)));
        };

        try {
            $counts = $this->importer->import(
                $stages,
                $progress,
                (int) $input->getOption('max-age'),
                (bool) $input->getOption('force-download'),
            );
        } catch (\Throwable $e) {
            // The run row is the only record of what went wrong once the console closes.
            $run->finish(ImportStatus::Failed, $e->getMessage());
            $this->em->flush();
            $io->error(\sprintf('Import failed during this run: %s', $e->getMessage()));

            return Command::FAILURE;
        }

        $run->setCounts($counts);
        $run->finish(ImportStatus::Completed);
        $this->em->flush();

        $rows = [];
        foreach ($counts as $stage => $stageCounts) {
            foreach ($stageCounts as $label => $value) {
                $rows[] = [$stage, $label, number_format($value)];
            }
        }
        $io->table(['Stage', 'What', 'Rows'], $rows);
        $io->success(\sprintf('Done in %s.', $this->humanDuration(microtime(true) - $started)));
        $io->writeln('Next: <comment>app:categories:rebuild-paths</comment> and <comment>app:sets:recount</comment>.');

        return Command::SUCCESS;
    }

    private function humanDuration(float $seconds): string
    {
        if ($seconds < 60) {
            return \sprintf('%.1fs', $seconds);
        }

        return \sprintf('%dm %ds', (int) ($seconds / 60), (int) $seconds % 60);
    }
}
