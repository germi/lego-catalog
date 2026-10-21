<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Where an alternate part number came from.
 *
 * Part 3001 also answers to 3001f1, 3556, 15589, 54534 and 72841, plus whatever
 * LEGO design IDs were moulded on it. Searching by any of them must work.
 */
enum PartNumberSource: string
{
    case BrickLink = 'bricklink';
    case BrickLinkAlternate = 'bricklink_alternate';
    case LegoDesignId = 'lego_design_id';
    case LDraw = 'ldraw';
    case Rebrickable = 'rebrickable';
    case Other = 'other';
}
