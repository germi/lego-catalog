<?php

declare(strict_types=1);

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Rebuilds the denormalised counters from the inventory lines.
 *
 * sets.num_parts counts regular set_element lines: no spares, and no parts that arrive
 * inside minifigures. sets.num_minifig_parts holds the latter, so that the box count is
 * the sum of the two — which reconciles exactly against published figures. Done in SQL
 * rather than through the ORM because it touches every set.
 */
#[AsCommand(
    name: 'app:sets:recount',
    description: 'Recompute part and minifigure counts on sets, and part counts on minifigures',
)]
final class RecountSetsCommand extends Command
{
    public function __construct(private readonly Connection $connection)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $sets = $this->connection->executeStatement(<<<'SQL'
            UPDATE `sets` s
            SET num_parts = COALESCE((
                SELECT SUM(se.quantity) FROM set_element se
                WHERE se.set_id = s.id AND se.role = 'regular'
            ), 0)
            SQL);

        $minifigsOnSets = $this->connection->executeStatement(<<<'SQL'
            UPDATE `sets` s
            SET num_minifigs = COALESCE((
                SELECT SUM(sm.quantity) FROM set_minifig sm
                WHERE sm.set_id = s.id AND sm.role = 'regular'
            ), 0)
            SQL);

        // Parts that come inside the set's minifigures. Kept in its own column because
        // the box count includes them and set_element does not.
        $minifigParts = $this->connection->executeStatement(<<<'SQL'
            UPDATE `sets` s
            SET num_minifig_parts = COALESCE((
                SELECT SUM(me.quantity * sm.quantity)
                FROM set_minifig sm
                JOIN minifig_element me ON me.minifig_id = sm.minifig_id
                WHERE sm.set_id = s.id AND sm.role = 'regular' AND me.role = 'regular'
            ), 0)
            SQL);

        $minifigs = $this->connection->executeStatement(<<<'SQL'
            UPDATE minifig m
            SET num_parts = COALESCE((
                SELECT SUM(me.quantity) FROM minifig_element me
                WHERE me.minifig_id = m.id AND me.role = 'regular'
            ), 0)
            SQL);

        $io->table(
            ['What', 'Rows touched'],
            [
                ['sets.num_parts', number_format($sets)],
                ['sets.num_minifigs', number_format($minifigsOnSets)],
                ['sets.num_minifig_parts', number_format($minifigParts)],
                ['minifig.num_parts', number_format($minifigs)],
            ],
        );
        $io->success('Counters rebuilt.');

        return Command::SUCCESS;
    }
}
