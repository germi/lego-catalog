<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * How a colour is finished — orthogonal to which family it belongs to.
 *
 * "Trans-Dark Blue" is family Blue, finish Transparent. BrickLink groups its colour
 * guide by these; it filters by family. Two axes, two fields.
 */
enum ColorFinish: string
{
    case Solid = 'solid';
    case Transparent = 'transparent';
    case Chrome = 'chrome';
    case Pearl = 'pearl';
    case Satin = 'satin';
    case Metallic = 'metallic';
    case Milky = 'milky';
    case Glitter = 'glitter';
    case Speckle = 'speckle';
    case Modulex = 'modulex';
    case Other = 'other';
}
