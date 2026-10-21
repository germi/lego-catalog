<?php

declare(strict_types=1);

namespace App\Enum;

/** What a part is made of. Mirrors Rebrickable's part_material values. */
enum PartMaterial: string
{
    case Plastic = 'plastic';
    case FlexiblePlastic = 'flexible_plastic';
    case Rubber = 'rubber';
    case Cloth = 'cloth';
    case Metal = 'metal';
    case Cardboard = 'cardboard';
    case Foam = 'foam';
    case Other = 'other';
}
