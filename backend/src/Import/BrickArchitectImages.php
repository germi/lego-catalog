<?php

declare(strict_types=1);

namespace App\Import;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Mirrors Brick Architect's part drawings.
 *
 * Tom Alphin's line drawings are the clearest part artwork there is, and they are used
 * here with his permission — they are not openly licensed, and the site otherwise states
 * that use of its content without permission is prohibited. Every place they appear must
 * credit him; see the README.
 *
 * The images are mirrored rather than hot-linked: 2,500 requests a page-load is not a
 * reasonable thing to do to someone else's server, the local copies survive his URLs
 * changing, and serving them same-origin avoids referrer and CORS surprises.
 *
 * Which parts he covers is discovered from his twelve top-level category pages, which
 * list every part in the guide along with its image URL. That is twelve requests to
 * learn the whole set, rather than probing all 64,901 of our part numbers against his
 * server to find the ~2,500 that exist.
 */
final class BrickArchitectImages
{
    private const BASE = 'https://brickarchitect.com';

    /**
     * The guide's twelve top-level categories. The sub-category pages are finer views of
     * the same parts, so these alone cover everything: they yield 2,509 unique parts,
     * which matches the "more than 2,500" the site claims.
     */
    private const CATEGORIES = [1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 106, 89];

    /** Part images live at a path keyed by design ID. Only this one size is published. */
    private const IMAGE_PATH = '/content/cache/parts/normal/50/';

    private Filesystem $filesystem;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire('%kernel.project_dir%/public/parts/brickarchitect')]
        private readonly string $targetDir,
    ) {
        $this->filesystem = new Filesystem();
    }

    /**
     * Part numbers the guide has a drawing for.
     *
     * @param callable(string):void $progress
     *
     * @return list<string>
     */
    public function discoverCoveredParts(callable $progress, int $delayMs = 400): array
    {
        $numbers = [];
        foreach (self::CATEGORIES as $category) {
            $url = self::BASE.'/parts/category-'.$category;
            $html = $this->httpClient->request('GET', $url)->getContent();

            $found = [];
            if (preg_match_all('#'.preg_quote(self::IMAGE_PATH, '#').'([^"\'/]+)\.png#i', $html, $matches)) {
                $found = array_unique($matches[1]);
            }
            foreach ($found as $number) {
                $numbers[$number] = true;
            }

            $progress(\sprintf('category-%d: %d parts', $category, \count($found)));
            $this->pause($delayMs);
        }

        // Cast back to string: PHP turns a numeric-looking array key into an int, so
        // "3001" would come out of array_keys() as the integer 3001 and every string
        // function downstream would choke on it.
        $list = array_map(static fn ($n): string => (string) $n, array_keys($numbers));
        sort($list);

        return $list;
    }

    /** Where a part's mirrored drawing lives, relative to the public directory. */
    public function publicPathFor(string $number): string
    {
        return '/parts/brickarchitect/'.$this->fileNameFor($number);
    }

    public function isMirrored(string $number): bool
    {
        return is_file($this->targetDir.'/'.$this->fileNameFor($number));
    }

    /**
     * Downloads one drawing. Returns false when the guide has no image for the part,
     * which is an ordinary outcome rather than an error.
     */
    public function mirror(string $number, int $delayMs = 400): bool
    {
        $response = $this->httpClient->request('GET', self::BASE.self::IMAGE_PATH.rawurlencode($number).'.png');
        $status = $response->getStatusCode();
        if (404 === $status) {
            $this->pause($delayMs);

            return false;
        }
        if (200 !== $status) {
            throw new \RuntimeException(\sprintf('Unexpected HTTP %d for part "%s".', $status, $number));
        }

        $content = $response->getContent();
        // A WordPress error page would also arrive as 200; PNG's magic bytes say otherwise.
        if (!str_starts_with($content, "\x89PNG\r\n\x1a\n")) {
            throw new \RuntimeException(\sprintf('Response for part "%s" is not a PNG.', $number));
        }

        $this->filesystem->mkdir($this->targetDir);
        // Written via a temp file so an interrupted run cannot leave a truncated image
        // that the next run would treat as already mirrored.
        $target = $this->targetDir.'/'.$this->fileNameFor($number);
        $this->filesystem->dumpFile($target.'.part', $content);
        $this->filesystem->rename($target.'.part', $target, true);

        $this->pause($delayMs);

        return true;
    }

    /** Part numbers are alphanumeric; keep them to a safe file name. */
    private function fileNameFor(string $number): string
    {
        return preg_replace('/[^A-Za-z0-9._-]/', '_', $number).'.png';
    }

    private function pause(int $delayMs): void
    {
        if ($delayMs > 0) {
            usleep($delayMs * 1000);
        }
    }
}
