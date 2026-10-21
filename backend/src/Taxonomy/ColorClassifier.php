<?php

declare(strict_types=1);

namespace App\Taxonomy;

use App\Enum\ColorFinish;

/**
 * Works out a colour's finish and hue family from its name.
 *
 * Rebrickable publishes a name, an RGB value and a transparency flag — not a family and
 * not a finish — but both are encoded in the naming convention the catalogues share:
 * "Trans-Dark Blue", "Chrome Silver", "Metallic Gold", "Glitter Trans-Purple". So this
 * reads them back out of the name, which is reliable for the finish and a good guess for
 * the family.
 *
 * The family is explicitly a guess: a colour whose name names no hue (Nougat, Flesh,
 * Sand) comes back null rather than wrong, and the colour's family can be corrected by
 * hand afterwards — which is why family is a nullable column and not derived on read.
 */
final class ColorClassifier
{
    /**
     * Longest-match-first: "Glitter Trans-Purple" is Glitter, not Transparent, and
     * "Metallic Pearl Gold" is Pearl rather than Metallic.
     *
     * @var array<string, ColorFinish>
     */
    private const FINISH_MARKERS = [
        'modulex' => ColorFinish::Modulex,
        'glitter' => ColorFinish::Glitter,
        'speckle' => ColorFinish::Speckle,
        'chrome' => ColorFinish::Chrome,
        'pearl' => ColorFinish::Pearl,
        'satin' => ColorFinish::Satin,
        'milky' => ColorFinish::Milky,
        'metallic' => ColorFinish::Metallic,
        'metal' => ColorFinish::Metallic,
        'trans' => ColorFinish::Transparent,
    ];

    /**
     * Hue keywords, again longest-match-first so "dark bluish gray" lands on Gray
     * rather than Blue and "lime" does not get read as part of a longer word.
     *
     * @var array<string, string> keyword => family slug
     */
    private const FAMILY_MARKERS = [
        'bluish gray' => 'gray',
        'bluish grey' => 'gray',
        'yellowish green' => 'green',
        'reddish brown' => 'brown',
        'dark azure' => 'blue',
        'medium azure' => 'blue',
        'azure' => 'blue',
        'aqua' => 'blue',
        'teal' => 'blue',
        'cyan' => 'blue',
        'turquoise' => 'blue',
        'terracotta' => 'brown',
        'lavender' => 'purple',
        'violet' => 'purple',
        'magenta' => 'purple',
        'lilac' => 'purple',
        'purple' => 'purple',
        'maroon' => 'red',
        'salmon' => 'pink',
        'coral' => 'pink',
        'rose' => 'pink',
        'pink' => 'pink',
        'olive' => 'green',
        'lime' => 'green',
        'green' => 'green',
        'blue' => 'blue',
        'brown' => 'brown',
        'tan' => 'brown',
        'nougat' => 'brown',
        'copper' => 'brown',
        'rust' => 'brown',
        'buff' => 'brown',
        'bronze' => 'brown',
        'brass' => 'yellow',
        'curry' => 'yellow',
        'lemon' => 'yellow',
        'gold' => 'yellow',
        'yellow' => 'yellow',
        'orange' => 'orange',
        'red' => 'red',
        'silver' => 'gray',
        'gray' => 'gray',
        'grey' => 'gray',
        'black' => 'black',
        'white' => 'white',
    ];

    public function finishFor(string $name, bool $isTransparent = false): ColorFinish
    {
        $haystack = mb_strtolower($name);
        foreach (self::FINISH_MARKERS as $marker => $finish) {
            if (str_contains($haystack, $marker)) {
                return $finish;
            }
        }

        // The source's own flag is the authority when the name says nothing.
        return $isTransparent ? ColorFinish::Transparent : ColorFinish::Solid;
    }

    /** Family slug, or null when the name names no hue. */
    public function familySlugFor(string $name): ?string
    {
        $haystack = mb_strtolower($name);
        foreach (self::FAMILY_MARKERS as $marker => $slug) {
            if (str_contains($haystack, $marker)) {
                return $slug;
            }
        }

        return null;
    }
}
