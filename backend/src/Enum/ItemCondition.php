<?php

declare(strict_types=1);

namespace App\Enum;

enum ItemCondition: string
{
    case New = 'new';
    case Used = 'used';
}
