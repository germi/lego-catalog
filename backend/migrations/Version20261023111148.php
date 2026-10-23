<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261023111148 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // Merge the twins before the constraint can exist.
        //
        // The category import used to key its upsert on (taxonomy_id, slug), but the slug
        // is derived from the name and uniqueSlug() treated an existing row's own slug as
        // a collision — so a second run generated "bricks-11" where the first had made
        // "bricks", matched nothing, and inserted a twin of every category. Assignments
        // landed on whichever row the last run wrote, leaving the other empty.
        //
        // The surviving row is the lowest id, which is the first run's and therefore the
        // one holding the un-suffixed slug. Everything pointing at a twin is repointed to
        // it. A part can only hold one assignment per taxonomy, so no collision is
        // possible when the assignments move across.
        $this->addSql(<<<'SQL'
            CREATE TEMPORARY TABLE _category_twins AS
            SELECT dead.id AS dead_id, keep.keeper_id
            FROM part_category dead
            JOIN (
                SELECT taxonomy_id, external_code, MIN(id) AS keeper_id
                FROM part_category
                WHERE external_code IS NOT NULL
                GROUP BY taxonomy_id, external_code
                HAVING COUNT(*) > 1
            ) keep
              ON keep.taxonomy_id = dead.taxonomy_id
             AND keep.external_code = dead.external_code
            WHERE dead.id <> keep.keeper_id
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE part_category_assignment a
            JOIN _category_twins t ON t.dead_id = a.category_id
            SET a.category_id = t.keeper_id
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE part p
            JOIN _category_twins t ON t.dead_id = p.primary_category_id
            SET p.primary_category_id = t.keeper_id
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE storage_location l
            JOIN _category_twins t ON t.dead_id = l.for_category_id
            SET l.for_category_id = t.keeper_id
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE part_category c
            JOIN _category_twins t ON t.dead_id = c.parent_id
            SET c.parent_id = t.keeper_id
            SQL);

        $this->addSql('DELETE c FROM part_category c JOIN _category_twins t ON t.dead_id = c.id');
        $this->addSql('DROP TEMPORARY TABLE _category_twins');

        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE UNIQUE INDEX uniq_part_category_taxonomy_code ON part_category (taxonomy_id, external_code)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP INDEX uniq_part_category_taxonomy_code ON part_category');
    }
}
