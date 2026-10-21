<?php

declare(strict_types=1);

namespace App\Enum;

enum SetCompleteness: string
{
    case Complete = 'complete';
    case Incomplete = 'incomplete';
    case Unknown = 'unknown';
}
