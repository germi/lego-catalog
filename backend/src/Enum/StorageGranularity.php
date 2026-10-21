<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * What a physical container holds, following Brick Architect's progression:
 * no organisation, then by group, then by part, then by part + colour — which is
 * to say, by element. A drawer labelled "1x Plates" is Category; a drawer of red
 * 2 x 4s is Element.
 */
enum StorageGranularity: string
{
    case Mixed = 'mixed';
    case Category = 'category';
    case Part = 'part';
    case Element = 'element';
}
