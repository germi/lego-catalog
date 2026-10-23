<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Part;
use App\Import\BrickArchitectImages;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Mirrors Brick Architect's part drawings and points parts at them.
 *
 * Used with Tom Alphin's permission; the drawings are not openly licensed. Credit him
 * wherever they are shown.
 *
 * Resumable by design: a part whose image is already on disk is skipped unless --force,
 * so an interrupted run costs nothing to repeat and a re-run after new parts arrive only
 * fetches what is missing.
 */
#[AsCommand(
    name: 'app:images:brickarchitect',
    description: "Mirror Brick Architect's part drawings and set Part.imageUrl",
)]
final class ImportBrickArchitectImagesCommand extends Command
{
    /** @var array<string, string> variant part number => the base number to fetch */
    private array $variantSource = [];

    public function __construct(
        private readonly BrickArchitectImages $images,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('delay', null, InputOption::VALUE_REQUIRED,
                'Milliseconds to wait between requests. Someone else is paying for this bandwidth.', '400')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED,
                'Stop after this many downloads, for a quick trial run')
            ->addOption('part', null, InputOption::VALUE_REQUIRED,
                'Mirror a single part number and nothing else')
            ->addOption('force', null, InputOption::VALUE_NONE,
                'Re-download images that are already mirrored');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $delay = (int) $input->getOption('delay');
        $force = (bool) $input->getOption('force');
        $limit = $input->getOption('limit') === null ? null : (int) $input->getOption('limit');

        $partRepository = $this->em->getRepository(Part::class);

        if (null !== $single = $input->getOption('part')) {
            $part = $partRepository->findOneBy(['number' => $single]);
            if (null === $part) {
                $io->error(\sprintf('No part numbered "%s" in the catalogue.', $single));

                return Command::INVALID;
            }

            if (!$this->images->mirror($single, $delay)) {
                $io->warning(\sprintf('Brick Architect has no drawing for part %s.', $single));

                return Command::SUCCESS;
            }
            $part->setImageUrl($this->images->publicPathFor($single));
            $this->em->flush();
            $io->success(\sprintf('Mirrored %s to %s', $single, $part->getImageUrl()));

            return Command::SUCCESS;
        }

        $io->title("Mirroring Brick Architect's part drawings");
        $io->writeln('<comment>Used with permission. Credit Tom Alphin wherever these appear.</comment>');
        $io->newLine();

        $io->section('Finding which parts the guide covers');
        $covered = $this->images->discoverCoveredParts(
            static fn (string $line) => $io->writeln('  '.$line),
            $delay,
        );
        $io->writeln(\sprintf('  <info>%d unique parts covered</info>', \count($covered)));

        // Only parts we actually hold are worth downloading; the rest are his, not ours.
        $ours = [];
        foreach (array_chunk($covered, 500) as $chunk) {
            foreach ($partRepository->findBy(['number' => $chunk]) as $part) {
                $ours[$part->getNumber()] = $part;
            }
        }
        $unmatched = array_diff($covered, array_keys($ours));

        // Brick Architect names a part by its base mould number where Rebrickable adds
        // a variant letter: his 2412 is our 2412a and 2412b, his 973 our 973c00. The
        // drawing is of the mould, so it is true of every variant of it — attach it to
        // all of them. Counted separately, because it is a guess about naming rather
        // than a match.
        $variantMatches = 0;
        $resolvedAsVariant = [];
        foreach ($unmatched as $number) {
            // Only a suffix on an otherwise identical number; never a longer number that
            // merely starts the same way (24121 is not a variant of 2412).
            $variants = $partRepository->createQueryBuilder('p')
                ->where('p.number LIKE :prefix')
                ->andWhere('LENGTH(p.number) <= :maxLength')
                ->setParameter('prefix', $number.'%')
                ->setParameter('maxLength', \strlen($number) + 3)
                ->getQuery()
                ->getResult();

            foreach ($variants as $variant) {
                $suffix = substr($variant->getNumber(), \strlen($number));
                if ('' === $suffix || 1 !== preg_match('/^[a-z][a-z0-9]{0,2}$/', $suffix)) {
                    continue;
                }
                $ours[$variant->getNumber()] = $variant;
                $this->variantSource[$variant->getNumber()] = $number;
                $resolvedAsVariant[$number] = true;
                ++$variantMatches;
            }
        }

        $stillUnmatched = array_values(array_filter(
            $unmatched,
            static fn (string $number): bool => !isset($resolvedAsVariant[$number]),
        ));

        $io->section('Mirroring');
        $downloaded = 0;
        $skipped = 0;
        $absent = 0;
        $flushEvery = 100;
        $processed = 0;

        $progress = $io->createProgressBar(\count($ours));
        $progress->start();

        // Iterating the values, not the keys: PHP casts a numeric-looking array key to
        // int, so a part numbered "3001" would come back as the integer 3001.
        foreach ($ours as $part) {
            $number = $part->getNumber();
            if (null !== $limit && $downloaded >= $limit) {
                break;
            }

            // A variant borrows the base mould's drawing, under the base number.
            $sourceNumber = $this->variantSource[$number] ?? $number;

            if (!$force && $this->images->isMirrored($sourceNumber)) {
                ++$skipped;
                // Still make sure the part points at the file; the download may have
                // succeeded on an earlier run that died before the flush.
                $part->setImageUrl($this->images->publicPathFor($sourceNumber));
            } elseif ($this->images->mirror($sourceNumber, $delay)) {
                ++$downloaded;
                $part->setImageUrl($this->images->publicPathFor($sourceNumber));
            } else {
                ++$absent;
            }

            if (0 === ++$processed % $flushEvery) {
                $this->em->flush();
            }
            $progress->advance();
        }

        $progress->finish();
        $this->em->flush();
        $io->newLine(2);

        $io->table(['What', 'Parts'], [
            ['covered by the guide', number_format(\count($covered))],
            ['of those, in our catalogue', number_format(\count($ours))],
            ['matched by exact number', number_format(\count($ours) - $variantMatches)],
            ['matched as a mould variant', number_format($variantMatches)],
            ['downloaded now', number_format($downloaded)],
            ['already mirrored', number_format($skipped)],
            ['no drawing after all', number_format($absent)],
        ]);

        if ([] !== $stillUnmatched) {
            $io->writeln(\sprintf(
                '<comment>Drawings we have no part for (first 10): %s</comment>',
                implode(', ', \array_slice($stillUnmatched, 0, 10)),
            ));
        }

        $io->success('Done.');

        return Command::SUCCESS;
    }
}
