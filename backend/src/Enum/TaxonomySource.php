<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Who defined a category tree.
 *
 * The three public ones disagree on purpose: BrickLink classifies by shape name
 * ("Brick, Modified"), Brick Architect by what you build with it ("SNOT"), and
 * Rebrickable keeps its own flat list of ~65. A part can sit in all three.
 */
enum TaxonomySource: string
{
    case Rebrickable = 'rebrickable';
    case BrickLink = 'bricklink';
    case BrickArchitect = 'brick_architect';
    case Custom = 'custom';
}
