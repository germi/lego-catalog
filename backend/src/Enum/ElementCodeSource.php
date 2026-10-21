<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Where an element code came from.
 *
 * LEGO reissues a colour under new element IDs over the decades, so one element
 * (part + colour) can carry several — 300121 and 4211385 are both the red 2 x 4.
 */
enum ElementCodeSource: string
{
    case LegoElementId = 'lego_element_id';
    case BrickLink = 'bricklink';
    case Rebrickable = 'rebrickable';
    case Other = 'other';
}
