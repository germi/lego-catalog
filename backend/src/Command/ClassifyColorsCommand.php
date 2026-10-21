<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Color;
use App\Entity\ColorFamily;
use App\Taxonomy\ColorClassifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Fills in the colour family on colours that do not have one.
 *
 * The importer deliberately cannot do this on a re-import: family is in its insert
 * columns but not its update list, so that a family you set by hand is never silently
 * revised by a dump that does not even carry the concept. The cost of that is that
 * improving the classifier does not reach rows that already exist — which is what this
 * command is for. It only ever fills a gap; --overwrite is there for when you really
 * do want the heuristic's opinion to win.
 */
#[AsCommand(
    name: 'app:colors:classify',
    description: 'Guess the colour family for colours that have none',
)]
final class ClassifyColorsCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ColorClassifier $classifier,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('overwrite', null, InputOption::VALUE_NONE,
                'Also reclassify colours that already have a family')
            ->addOption('dry-run', null, InputOption::VALUE_NONE,
                'Show what would change without writing');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $overwrite = (bool) $input->getOption('overwrite');
        $dryRun = (bool) $input->getOption('dry-run');

        $families = [];
        foreach ($this->em->getRepository(ColorFamily::class)->findAll() as $family) {
            $families[$family->getSlug()] = $family;
        }

        $changed = [];
        $stillUnknown = [];

        foreach ($this->em->getRepository(Color::class)->findAll() as $color) {
            if (null !== $color->getFamily() && !$overwrite) {
                continue;
            }

            $slug = $this->classifier->familySlugFor($color->getName());
            if (null === $slug || !isset($families[$slug])) {
                $stillUnknown[] = $color->getName();
                continue;
            }
            if ($color->getFamily() === $families[$slug]) {
                continue;
            }

            $changed[] = [$color->getName(), $color->getFamily()?->getName() ?? '—', $families[$slug]->getName()];
            if (!$dryRun) {
                $color->setFamily($families[$slug]);
            }
        }

        if (!$dryRun) {
            $this->em->flush();
        }

        if ([] !== $changed) {
            $io->table(['Colour', 'Was', 'Now'], $changed);
        }
        $io->writeln(\sprintf(
            '%d classified, %d left without a family%s.',
            \count($changed),
            \count($stillUnknown),
            $dryRun ? ' (dry run, nothing written)' : '',
        ));
        if ([] !== $stillUnknown) {
            // Names with no hue in them — Trans-Clear, [Unknown], Glow In Dark. Leaving
            // these null is the right answer, not a gap to be filled with a bad guess.
            $io->writeln('<comment>No hue in the name: '.implode(', ', \array_slice($stillUnknown, 0, 20)).'</comment>');
        }

        return Command::SUCCESS;
    }
}
