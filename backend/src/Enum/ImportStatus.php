<?php

declare(strict_types=1);

namespace App\Enum;

enum ImportStatus: string
{
    case Running = 'running';
    case Completed = 'completed';
    case Failed = 'failed';
}
