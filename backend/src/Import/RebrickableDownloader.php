<?php

declare(strict_types=1);

namespace App\Import;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Fetches Rebrickable's published CSV dumps and keeps them on disk.
 *
 * The files are public — only their REST API needs a key — and they are regenerated
 * daily, so a cached copy is reused until it is older than the max age. Downloads are
 * streamed to a temporary file and moved into place, so an interrupted run cannot leave
 * a half-written dump that the next run would happily read.
 */
final class RebrickableDownloader
{
    /** The twelve files that make up the catalogue. */
    public const FILES = [
        'colors',
        'part_categories',
        'parts',
        'part_relationships',
        'elements',
        'themes',
        'sets',
        'minifigs',
        'inventories',
        'inventory_parts',
        'inventory_sets',
        'inventory_minifigs',
    ];

    private Filesystem $filesystem;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire('%env(REBRICKABLE_DOWNLOAD_BASE)%')]
        private readonly string $downloadBase,
        #[Autowire('%kernel.project_dir%/%env(REBRICKABLE_CACHE_DIR)%')]
        private readonly string $cacheDir,
    ) {
        $this->filesystem = new Filesystem();
    }

    /** Absolute path to a usable local copy of one dump, downloading it if needed. */
    public function fetch(string $name, int $maxAgeSeconds = 86400, bool $force = false): string
    {
        if (!\in_array($name, self::FILES, true)) {
            throw new \InvalidArgumentException(\sprintf('Unknown Rebrickable file "%s".', $name));
        }

        $target = $this->cacheDir.'/'.$name.'.csv.gz';
        if (!$force && is_file($target) && (time() - (int) filemtime($target)) < $maxAgeSeconds) {
            return $target;
        }

        $this->filesystem->mkdir($this->cacheDir);
        $temp = $target.'.part';

        $response = $this->httpClient->request('GET', \sprintf('%s/%s.csv.gz', rtrim($this->downloadBase, '/'), $name));
        $handle = fopen($temp, 'wb');
        if (false === $handle) {
            throw new \RuntimeException(\sprintf('Cannot write to "%s".', $temp));
        }

        try {
            foreach ($this->httpClient->stream($response) as $chunk) {
                fwrite($handle, $chunk->getContent());
            }
        } finally {
            fclose($handle);
        }

        $this->filesystem->rename($temp, $target, true);

        return $target;
    }

    public function cacheDir(): string
    {
        return $this->cacheDir;
    }
}
