<?php

declare(strict_types=1);

namespace App\Import;

/**
 * Reads a gzipped CSV, yielding each row keyed by column name.
 *
 * Mapping by header name rather than by position: the source publishes these files
 * daily and a reordered column should not silently shift every value one to the left.
 * A missing expected column is a hard error instead, raised before any row is read.
 */
final class CsvReader
{
    /**
     * @param list<string> $required column names that must be present
     *
     * @return \Generator<int, array<string, string>>
     */
    public function rows(string $path, array $required = []): \Generator
    {
        $handle = str_ends_with($path, '.gz') ? gzopen($path, 'rb') : fopen($path, 'rb');
        if (false === $handle) {
            throw new \RuntimeException(\sprintf('Cannot open "%s".', $path));
        }

        try {
            $header = $this->readLine($handle, $path);
            if (null === $header) {
                throw new \RuntimeException(\sprintf('"%s" is empty.', $path));
            }
            // Strip a UTF-8 BOM from the first column name, or every lookup on it fails.
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]) ?? $header[0];

            $missing = array_diff($required, $header);
            if ([] !== $missing) {
                throw new \RuntimeException(\sprintf(
                    '"%s" is missing the column(s) %s. Found: %s.',
                    basename($path),
                    implode(', ', $missing),
                    implode(', ', $header),
                ));
            }

            $width = \count($header);
            while (null !== ($values = $this->readLine($handle, $path))) {
                // Short rows happen; pad rather than letting array_combine fail.
                if (\count($values) !== $width) {
                    $values = array_slice(array_pad($values, $width, ''), 0, $width);
                }

                yield array_combine($header, $values);
            }
        } finally {
            str_ends_with($path, '.gz') ? gzclose($handle) : fclose($handle);
        }
    }

    /**
     * @param resource $handle
     *
     * @return list<string>|null
     */
    private function readLine($handle, string $path): ?array
    {
        $row = fgetcsv($handle, 0, ',', '"', '');
        if (false === $row || null === $row) {
            return null;
        }
        // A blank trailing line reads as [null].
        if ([null] === $row) {
            return $this->readLine($handle, $path);
        }

        return array_map(static fn ($v) => (string) $v, $row);
    }
}
