<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\PartCategory;
use App\Entity\StorageLocation;
use App\Entity\Theme;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Recomputes the materialised path and depth on every tree in the schema.
 *
 * These columns are derived from the parent chain, and moving a node has to update its
 * whole subtree — which an entity cannot see from inside a lifecycle callback. So they
 * are rebuilt here, shallowest first, after anything that reparents a node.
 */
#[AsCommand(
    name: 'app:categories:rebuild-paths',
    description: 'Rebuild path and depth on part categories, themes and storage locations',
)]
final class RebuildPathsCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $totals = [];

        foreach ([PartCategory::class, Theme::class, StorageLocation::class] as $class) {
            $nodes = $this->em->getRepository($class)->findAll();
            // Shallowest first, so a parent's path is already correct when a child reads it.
            usort($nodes, static fn (object $a, object $b): int => self::ancestry($a) <=> self::ancestry($b));
            foreach ($nodes as $node) {
                $node->rebuildPath();
            }
            $this->em->flush();
            $totals[] = [substr($class, strrpos($class, '\\') + 1), \count($nodes)];
        }

        $io->table(['Tree', 'Nodes'], $totals);
        $io->success('Paths rebuilt.');

        return Command::SUCCESS;
    }

    private static function ancestry(object $node): int
    {
        $depth = 0;
        $cursor = $node->getParent();
        while (null !== $cursor && $depth < 64) {
            ++$depth;
            $cursor = $cursor->getParent();
        }

        return $depth;
    }
}
