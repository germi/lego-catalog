<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * How two parts relate. Directed: parent is the plainer / whole one.
 *
 * Taken from Rebrickable's set, which is the most complete of the three catalogs.
 * Print is why a decorated head (3626cpb0001) is its own part rather than a flag on
 * an element: the print then exists in its own set of colours.
 */
enum PartRelationType: string
{
    case Print = 'print';
    case Pattern = 'pattern';
    case MouldVariant = 'mould_variant';
    case Pair = 'pair';
    case Alternate = 'alternate';
    case SubPart = 'sub_part';
}
