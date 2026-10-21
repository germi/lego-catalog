<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261021114445 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE color (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(128) NOT NULL, hex VARCHAR(7) DEFAULT NULL, finish VARCHAR(255) DEFAULT \'solid\' NOT NULL, lego_name VARCHAR(128) DEFAULT NULL, lego_id INT DEFAULT NULL, bricklink_id INT DEFAULT NULL, ldraw_id INT DEFAULT NULL, rebrickable_id INT DEFAULT NULL, year_from INT DEFAULT NULL, year_to INT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, family_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_665648E95E237E06 (name), UNIQUE INDEX UNIQ_665648E9989D9B62 (slug), UNIQUE INDEX UNIQ_665648E9CF1B38AE (rebrickable_id), INDEX idx_color_family (family_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE color_family (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(64) NOT NULL, slug VARCHAR(64) NOT NULL, swatch_hex VARCHAR(7) DEFAULT NULL, sort_order INT DEFAULT 0 NOT NULL, notes LONGTEXT DEFAULT NULL, UNIQUE INDEX UNIQ_80F83FA95E237E06 (name), UNIQUE INDEX UNIQ_80F83FA9989D9B62 (slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE element (id INT AUTO_INCREMENT NOT NULL, image_url LONGTEXT DEFAULT NULL, year_from INT DEFAULT NULL, year_to INT DEFAULT NULL, is_active TINYINT DEFAULT 1 NOT NULL, notes LONGTEXT DEFAULT NULL, part_id INT NOT NULL, color_id INT NOT NULL, INDEX idx_element_color (color_id), UNIQUE INDEX uniq_element_part_color (part_id, color_id), INDEX IDX_41405E394CE34BEC (part_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE element_code (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(32) NOT NULL, source VARCHAR(255) NOT NULL, is_primary TINYINT DEFAULT 0 NOT NULL, element_id INT NOT NULL, INDEX idx_element_code_element (element_id), UNIQUE INDEX uniq_element_code_code_source (code, source), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE import_run (id INT AUTO_INCREMENT NOT NULL, source VARCHAR(32) NOT NULL, status VARCHAR(255) DEFAULT \'running\' NOT NULL, started_at DATETIME NOT NULL, finished_at DATETIME DEFAULT NULL, counts JSON NOT NULL, error LONGTEXT DEFAULT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE minifig (id INT AUTO_INCREMENT NOT NULL, number VARCHAR(32) NOT NULL, name VARCHAR(255) NOT NULL, year_from INT DEFAULT NULL, year_to INT DEFAULT NULL, num_parts INT DEFAULT 0 NOT NULL, image_url LONGTEXT DEFAULT NULL, rebrickable_id VARCHAR(32) DEFAULT NULL, notes LONGTEXT DEFAULT NULL, theme_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_13694EEB96901F54 (number), UNIQUE INDEX UNIQ_13694EEBCF1B38AE (rebrickable_id), INDEX idx_minifig_theme (theme_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE minifig_element (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, role VARCHAR(255) DEFAULT \'regular\' NOT NULL, minifig_id INT NOT NULL, element_id INT NOT NULL, INDEX idx_minifig_element_element (element_id), UNIQUE INDEX uniq_minifig_element_line (minifig_id, element_id, role), INDEX IDX_F73D3B9799624115 (minifig_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE moc (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, slug VARCHAR(160) NOT NULL, author VARCHAR(128) DEFAULT NULL, url LONGTEXT DEFAULT NULL, image_url LONGTEXT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, based_on_set_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_8990C6EB989D9B62 (slug), INDEX IDX_8990C6EB17B63FE (based_on_set_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE moc_element (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, moc_id INT NOT NULL, element_id INT NOT NULL, INDEX idx_moc_element_element (element_id), UNIQUE INDEX uniq_moc_element_line (moc_id, element_id), INDEX IDX_E5EFE862AE591974 (moc_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE owned_element (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 0 NOT NULL, item_condition VARCHAR(255) DEFAULT \'used\' NOT NULL, notes LONGTEXT DEFAULT NULL, updated_at DATETIME NOT NULL, element_id INT NOT NULL, storage_location_id INT NOT NULL, INDEX idx_owned_element_location (storage_location_id), UNIQUE INDEX uniq_owned_element_holding (element_id, item_condition, storage_location_id), INDEX IDX_12ECE31D1F1F2A24 (element_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE owned_set (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, item_condition VARCHAR(255) DEFAULT \'used\' NOT NULL, completeness VARCHAR(255) DEFAULT \'unknown\' NOT NULL, has_box TINYINT DEFAULT 0 NOT NULL, has_instructions TINYINT DEFAULT 0 NOT NULL, is_built TINYINT DEFAULT 0 NOT NULL, acquired_on DATE DEFAULT NULL, price_paid DOUBLE PRECISION DEFAULT NULL, currency VARCHAR(8) DEFAULT NULL, notes LONGTEXT DEFAULT NULL, set_id INT NOT NULL, storage_location_id INT DEFAULT NULL, INDEX idx_owned_set_set (set_id), INDEX IDX_A67F59B4CDDD8AF (storage_location_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE part (id INT AUTO_INCREMENT NOT NULL, number VARCHAR(64) NOT NULL, name VARCHAR(255) NOT NULL, short_name VARCHAR(128) DEFAULT NULL, material VARCHAR(255) DEFAULT \'plastic\' NOT NULL, stud_x DOUBLE PRECISION DEFAULT NULL, stud_y DOUBLE PRECISION DEFAULT NULL, stud_z DOUBLE PRECISION DEFAULT NULL, weight_grams DOUBLE PRECISION DEFAULT NULL, year_from INT DEFAULT NULL, year_to INT DEFAULT NULL, is_decorated TINYINT DEFAULT 0 NOT NULL, ldraw_id VARCHAR(64) DEFAULT NULL, rebrickable_id VARCHAR(64) DEFAULT NULL, image_url LONGTEXT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, primary_category_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_490F70C696901F54 (number), UNIQUE INDEX UNIQ_490F70C6CF1B38AE (rebrickable_id), INDEX idx_part_name (name), INDEX idx_part_primary_category (primary_category_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE part_category (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(128) NOT NULL, path VARCHAR(512) DEFAULT \'\' NOT NULL, depth INT DEFAULT 0 NOT NULL, external_code VARCHAR(64) DEFAULT NULL, sort_order INT DEFAULT 0 NOT NULL, taxonomy_id INT NOT NULL, parent_id INT DEFAULT NULL, INDEX idx_part_category_path (path), INDEX idx_part_category_parent (parent_id), UNIQUE INDEX uniq_part_category_taxonomy_slug (taxonomy_id, slug), INDEX IDX_911E9CBE9557E6F6 (taxonomy_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE part_category_assignment (id INT AUTO_INCREMENT NOT NULL, part_id INT NOT NULL, category_id INT NOT NULL, taxonomy_id INT NOT NULL, INDEX idx_assignment_category (category_id), UNIQUE INDEX uniq_assignment_part_taxonomy (part_id, taxonomy_id), INDEX IDX_2CCA4AC4CE34BEC (part_id), INDEX IDX_2CCA4AC9557E6F6 (taxonomy_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE part_number (id INT AUTO_INCREMENT NOT NULL, number VARCHAR(64) NOT NULL, source VARCHAR(255) NOT NULL, part_id INT NOT NULL, INDEX idx_part_number_part (part_id), INDEX idx_part_number_number (number), UNIQUE INDEX uniq_part_number_number_source (number, source), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE part_relationship (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(255) NOT NULL, parent_part_id INT NOT NULL, child_part_id INT NOT NULL, INDEX idx_part_relationship_child (child_part_id), UNIQUE INDEX uniq_part_relationship (parent_part_id, child_part_id, type), INDEX IDX_124014303EAB3FAA (parent_part_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE set_element (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, role VARCHAR(255) DEFAULT \'regular\' NOT NULL, match_group INT DEFAULT 0 NOT NULL, set_id INT NOT NULL, element_id INT NOT NULL, INDEX idx_set_element_element (element_id), UNIQUE INDEX uniq_set_element_line (set_id, element_id, role, match_group), INDEX IDX_C6ECB8DE10FB0D18 (set_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE set_minifig (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, role VARCHAR(255) DEFAULT \'regular\' NOT NULL, set_id INT NOT NULL, minifig_id INT NOT NULL, INDEX idx_set_minifig_minifig (minifig_id), UNIQUE INDEX uniq_set_minifig_line (set_id, minifig_id, role), INDEX IDX_94C5A80C10FB0D18 (set_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE set_subset (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, set_id INT NOT NULL, child_set_id INT NOT NULL, INDEX idx_set_subset_child (child_set_id), UNIQUE INDEX uniq_set_subset_line (set_id, child_set_id), INDEX IDX_217947A410FB0D18 (set_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE sets (id INT AUTO_INCREMENT NOT NULL, number VARCHAR(32) NOT NULL, base_number VARCHAR(24) NOT NULL, variant INT DEFAULT 1 NOT NULL, name VARCHAR(255) NOT NULL, year INT DEFAULT NULL, num_parts INT DEFAULT 0 NOT NULL, num_minifigs INT DEFAULT 0 NOT NULL, weight_grams DOUBLE PRECISION DEFAULT NULL, box_width_cm DOUBLE PRECISION DEFAULT NULL, box_height_cm DOUBLE PRECISION DEFAULT NULL, box_depth_cm DOUBLE PRECISION DEFAULT NULL, released_on DATE DEFAULT NULL, retired_on DATE DEFAULT NULL, instructions_count INT DEFAULT 0 NOT NULL, image_url LONGTEXT DEFAULT NULL, rebrickable_id VARCHAR(32) DEFAULT NULL, inventory_version INT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, theme_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_948D45D196901F54 (number), UNIQUE INDEX UNIQ_948D45D1CF1B38AE (rebrickable_id), INDEX idx_sets_base_number (base_number), INDEX idx_sets_theme (theme_id), INDEX idx_sets_year (year), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE storage_location (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(160) NOT NULL, label VARCHAR(64) DEFAULT NULL, granularity VARCHAR(255) DEFAULT \'mixed\' NOT NULL, path VARCHAR(512) DEFAULT \'\' NOT NULL, depth INT DEFAULT 0 NOT NULL, sort_order INT DEFAULT 0 NOT NULL, notes LONGTEXT DEFAULT NULL, parent_id INT DEFAULT NULL, for_category_id INT DEFAULT NULL, for_part_id INT DEFAULT NULL, for_element_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_FD55B58C989D9B62 (slug), INDEX idx_storage_location_parent (parent_id), INDEX idx_storage_location_path (path), INDEX IDX_FD55B58C80D88995 (for_category_id), INDEX IDX_FD55B58C70D62CC1 (for_part_id), INDEX IDX_FD55B58C5385C6E8 (for_element_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE taxonomy (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(64) NOT NULL, source VARCHAR(255) NOT NULL, is_default TINYINT DEFAULT 0 NOT NULL, description LONGTEXT DEFAULT NULL, UNIQUE INDEX UNIQ_FD12B83D989D9B62 (slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE theme (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(160) NOT NULL, path VARCHAR(512) DEFAULT \'\' NOT NULL, depth INT DEFAULT 0 NOT NULL, rebrickable_id INT DEFAULT NULL, parent_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_9775E708CF1B38AE (rebrickable_id), INDEX idx_theme_path (path), INDEX idx_theme_parent (parent_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE wanted_line (id INT AUTO_INCREMENT NOT NULL, quantity INT DEFAULT 1 NOT NULL, priority INT DEFAULT 0 NOT NULL, max_price DOUBLE PRECISION DEFAULT NULL, currency VARCHAR(8) DEFAULT NULL, notes LONGTEXT DEFAULT NULL, list_id INT NOT NULL, element_id INT DEFAULT NULL, set_id INT DEFAULT NULL, minifig_id INT DEFAULT NULL, INDEX idx_wanted_line_list (list_id), INDEX IDX_3EF841701F1F2A24 (element_id), INDEX IDX_3EF8417010FB0D18 (set_id), INDEX IDX_3EF8417099624115 (minifig_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE wanted_list (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(128) NOT NULL, slug VARCHAR(160) NOT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_AB240D9E989D9B62 (slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE color ADD CONSTRAINT FK_665648E9C35E566A FOREIGN KEY (family_id) REFERENCES color_family (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E394CE34BEC FOREIGN KEY (part_id) REFERENCES part (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E397ADA1FB5 FOREIGN KEY (color_id) REFERENCES color (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element_code ADD CONSTRAINT FK_342B11611F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE minifig ADD CONSTRAINT FK_13694EEB59027487 FOREIGN KEY (theme_id) REFERENCES theme (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE minifig_element ADD CONSTRAINT FK_F73D3B9799624115 FOREIGN KEY (minifig_id) REFERENCES minifig (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE minifig_element ADD CONSTRAINT FK_F73D3B971F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE moc ADD CONSTRAINT FK_8990C6EB17B63FE FOREIGN KEY (based_on_set_id) REFERENCES sets (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE moc_element ADD CONSTRAINT FK_E5EFE862AE591974 FOREIGN KEY (moc_id) REFERENCES moc (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE moc_element ADD CONSTRAINT FK_E5EFE8621F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE owned_element ADD CONSTRAINT FK_12ECE31D1F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE owned_element ADD CONSTRAINT FK_12ECE31DCDDD8AF FOREIGN KEY (storage_location_id) REFERENCES storage_location (id) ON DELETE RESTRICT');
        $this->addSql('ALTER TABLE owned_set ADD CONSTRAINT FK_A67F59B410FB0D18 FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE owned_set ADD CONSTRAINT FK_A67F59B4CDDD8AF FOREIGN KEY (storage_location_id) REFERENCES storage_location (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE part ADD CONSTRAINT FK_490F70C6B6A9FD63 FOREIGN KEY (primary_category_id) REFERENCES part_category (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE part_category ADD CONSTRAINT FK_911E9CBE9557E6F6 FOREIGN KEY (taxonomy_id) REFERENCES taxonomy (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_category ADD CONSTRAINT FK_911E9CBE727ACA70 FOREIGN KEY (parent_id) REFERENCES part_category (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_category_assignment ADD CONSTRAINT FK_2CCA4AC4CE34BEC FOREIGN KEY (part_id) REFERENCES part (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_category_assignment ADD CONSTRAINT FK_2CCA4AC12469DE2 FOREIGN KEY (category_id) REFERENCES part_category (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_category_assignment ADD CONSTRAINT FK_2CCA4AC9557E6F6 FOREIGN KEY (taxonomy_id) REFERENCES taxonomy (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_number ADD CONSTRAINT FK_AF00DFC14CE34BEC FOREIGN KEY (part_id) REFERENCES part (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_relationship ADD CONSTRAINT FK_124014303EAB3FAA FOREIGN KEY (parent_part_id) REFERENCES part (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE part_relationship ADD CONSTRAINT FK_124014302E5703F7 FOREIGN KEY (child_part_id) REFERENCES part (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_element ADD CONSTRAINT FK_C6ECB8DE10FB0D18 FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_element ADD CONSTRAINT FK_C6ECB8DE1F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_minifig ADD CONSTRAINT FK_94C5A80C10FB0D18 FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_minifig ADD CONSTRAINT FK_94C5A80C99624115 FOREIGN KEY (minifig_id) REFERENCES minifig (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_subset ADD CONSTRAINT FK_217947A410FB0D18 FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE set_subset ADD CONSTRAINT FK_217947A479AEC944 FOREIGN KEY (child_set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE sets ADD CONSTRAINT FK_948D45D159027487 FOREIGN KEY (theme_id) REFERENCES theme (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE storage_location ADD CONSTRAINT FK_FD55B58C727ACA70 FOREIGN KEY (parent_id) REFERENCES storage_location (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE storage_location ADD CONSTRAINT FK_FD55B58C80D88995 FOREIGN KEY (for_category_id) REFERENCES part_category (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE storage_location ADD CONSTRAINT FK_FD55B58C70D62CC1 FOREIGN KEY (for_part_id) REFERENCES part (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE storage_location ADD CONSTRAINT FK_FD55B58C5385C6E8 FOREIGN KEY (for_element_id) REFERENCES element (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE theme ADD CONSTRAINT FK_9775E708727ACA70 FOREIGN KEY (parent_id) REFERENCES theme (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE wanted_line ADD CONSTRAINT FK_3EF841703DAE168B FOREIGN KEY (list_id) REFERENCES wanted_list (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE wanted_line ADD CONSTRAINT FK_3EF841701F1F2A24 FOREIGN KEY (element_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE wanted_line ADD CONSTRAINT FK_3EF8417010FB0D18 FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE wanted_line ADD CONSTRAINT FK_3EF8417099624115 FOREIGN KEY (minifig_id) REFERENCES minifig (id) ON DELETE CASCADE');
        // A wanted line points at exactly one of element, set or minifig. Doctrine's
        // mapping cannot express this, and the entity's validator callback only guards
        // the API — this keeps a direct SQL insert honest too.
        $this->addSql('ALTER TABLE wanted_line ADD CONSTRAINT chk_wanted_line_one_target CHECK ((element_id IS NOT NULL) + (set_id IS NOT NULL) + (minifig_id IS NOT NULL) = 1)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE wanted_line DROP CONSTRAINT chk_wanted_line_one_target');
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE color DROP FOREIGN KEY FK_665648E9C35E566A');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E394CE34BEC');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E397ADA1FB5');
        $this->addSql('ALTER TABLE element_code DROP FOREIGN KEY FK_342B11611F1F2A24');
        $this->addSql('ALTER TABLE minifig DROP FOREIGN KEY FK_13694EEB59027487');
        $this->addSql('ALTER TABLE minifig_element DROP FOREIGN KEY FK_F73D3B9799624115');
        $this->addSql('ALTER TABLE minifig_element DROP FOREIGN KEY FK_F73D3B971F1F2A24');
        $this->addSql('ALTER TABLE moc DROP FOREIGN KEY FK_8990C6EB17B63FE');
        $this->addSql('ALTER TABLE moc_element DROP FOREIGN KEY FK_E5EFE862AE591974');
        $this->addSql('ALTER TABLE moc_element DROP FOREIGN KEY FK_E5EFE8621F1F2A24');
        $this->addSql('ALTER TABLE owned_element DROP FOREIGN KEY FK_12ECE31D1F1F2A24');
        $this->addSql('ALTER TABLE owned_element DROP FOREIGN KEY FK_12ECE31DCDDD8AF');
        $this->addSql('ALTER TABLE owned_set DROP FOREIGN KEY FK_A67F59B410FB0D18');
        $this->addSql('ALTER TABLE owned_set DROP FOREIGN KEY FK_A67F59B4CDDD8AF');
        $this->addSql('ALTER TABLE part DROP FOREIGN KEY FK_490F70C6B6A9FD63');
        $this->addSql('ALTER TABLE part_category DROP FOREIGN KEY FK_911E9CBE9557E6F6');
        $this->addSql('ALTER TABLE part_category DROP FOREIGN KEY FK_911E9CBE727ACA70');
        $this->addSql('ALTER TABLE part_category_assignment DROP FOREIGN KEY FK_2CCA4AC4CE34BEC');
        $this->addSql('ALTER TABLE part_category_assignment DROP FOREIGN KEY FK_2CCA4AC12469DE2');
        $this->addSql('ALTER TABLE part_category_assignment DROP FOREIGN KEY FK_2CCA4AC9557E6F6');
        $this->addSql('ALTER TABLE part_number DROP FOREIGN KEY FK_AF00DFC14CE34BEC');
        $this->addSql('ALTER TABLE part_relationship DROP FOREIGN KEY FK_124014303EAB3FAA');
        $this->addSql('ALTER TABLE part_relationship DROP FOREIGN KEY FK_124014302E5703F7');
        $this->addSql('ALTER TABLE set_element DROP FOREIGN KEY FK_C6ECB8DE10FB0D18');
        $this->addSql('ALTER TABLE set_element DROP FOREIGN KEY FK_C6ECB8DE1F1F2A24');
        $this->addSql('ALTER TABLE set_minifig DROP FOREIGN KEY FK_94C5A80C10FB0D18');
        $this->addSql('ALTER TABLE set_minifig DROP FOREIGN KEY FK_94C5A80C99624115');
        $this->addSql('ALTER TABLE set_subset DROP FOREIGN KEY FK_217947A410FB0D18');
        $this->addSql('ALTER TABLE set_subset DROP FOREIGN KEY FK_217947A479AEC944');
        $this->addSql('ALTER TABLE sets DROP FOREIGN KEY FK_948D45D159027487');
        $this->addSql('ALTER TABLE storage_location DROP FOREIGN KEY FK_FD55B58C727ACA70');
        $this->addSql('ALTER TABLE storage_location DROP FOREIGN KEY FK_FD55B58C80D88995');
        $this->addSql('ALTER TABLE storage_location DROP FOREIGN KEY FK_FD55B58C70D62CC1');
        $this->addSql('ALTER TABLE storage_location DROP FOREIGN KEY FK_FD55B58C5385C6E8');
        $this->addSql('ALTER TABLE theme DROP FOREIGN KEY FK_9775E708727ACA70');
        $this->addSql('ALTER TABLE wanted_line DROP FOREIGN KEY FK_3EF841703DAE168B');
        $this->addSql('ALTER TABLE wanted_line DROP FOREIGN KEY FK_3EF841701F1F2A24');
        $this->addSql('ALTER TABLE wanted_line DROP FOREIGN KEY FK_3EF8417010FB0D18');
        $this->addSql('ALTER TABLE wanted_line DROP FOREIGN KEY FK_3EF8417099624115');
        $this->addSql('DROP TABLE color');
        $this->addSql('DROP TABLE color_family');
        $this->addSql('DROP TABLE element');
        $this->addSql('DROP TABLE element_code');
        $this->addSql('DROP TABLE import_run');
        $this->addSql('DROP TABLE minifig');
        $this->addSql('DROP TABLE minifig_element');
        $this->addSql('DROP TABLE moc');
        $this->addSql('DROP TABLE moc_element');
        $this->addSql('DROP TABLE owned_element');
        $this->addSql('DROP TABLE owned_set');
        $this->addSql('DROP TABLE part');
        $this->addSql('DROP TABLE part_category');
        $this->addSql('DROP TABLE part_category_assignment');
        $this->addSql('DROP TABLE part_number');
        $this->addSql('DROP TABLE part_relationship');
        $this->addSql('DROP TABLE set_element');
        $this->addSql('DROP TABLE set_minifig');
        $this->addSql('DROP TABLE set_subset');
        $this->addSql('DROP TABLE sets');
        $this->addSql('DROP TABLE storage_location');
        $this->addSql('DROP TABLE taxonomy');
        $this->addSql('DROP TABLE theme');
        $this->addSql('DROP TABLE wanted_line');
        $this->addSql('DROP TABLE wanted_list');
    }
}
