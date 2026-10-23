/**
 * Resolves a path the API returned (like "/parts/brickarchitect/3001.png") to something
 * the browser can load.
 *
 * In production Symfony serves both the SPA and these files, so the path is already
 * right. In dev the SPA is on Vite's port and the files are on Symfony's, so the API
 * base URL has to be put back in front.
 */
export default function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path)) return path;

  const base = (import.meta.env.VITE_API_URL || "/").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
