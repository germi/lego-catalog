<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Why a line is in an inventory. BrickLink's vocabulary.
 *
 * Spare is BrickLink's "Extra" — the loose spares in the bag. They must never be
 * counted toward a set's part count. Counterpart is a part with a sticker applied.
 * Alternate marks items that differ between official releases of the same kit, and
 * pairs with the line it substitutes for through the match group.
 */
enum InventoryRole: string
{
    case Regular = 'regular';
    case Spare = 'spare';
    case Counterpart = 'counterpart';
    case Alternate = 'alternate';
}
