import * as d3 from "d3";
import textures from "textures";

/**
 * Adapter layer between the textures.js library and BaseMap's fill system.
 *
 * The textures library uses a D3 call pattern:
 *   svg.call(t)   — registers the <pattern> in <defs>
 *   t.url()       — returns "url(#id)"
 *
 * BaseMap expects:
 *   t.register(svgEl)  — same thing, idempotent
 *   t.url()            — same
 *
 * Usage:
 *   import textures from "textures"
 *   import { fromTexture } from "@/components/sidecharts/fill/texture"
 *
 *   data = {
 *     FRA: { texture: fromTexture(textures.lines().stroke("#1e3a8a").size(8)) },
 *     DEU: { texture: fromTexture(textures.circles().fill("#ef4444").radius(3)) },
 *     GBR: { texture: fromTexture(textures.paths().d("woven").stroke("#10b981")) },
 *   }
 *
 * The textures library is re-exported below so you only need one import.
 */

export { default as textures } from "textures";

/**
 * Wraps a textures.js instance into the { register(svgEl), url() } shape
 * that BaseMap expects. Registration is idempotent.
 *
 * @param {object} t — a textures.js texture instance
 */
export function fromTexture(t) {
  const registered = new WeakSet();
  return {
    register(svgEl) {
      if (!svgEl || registered.has(svgEl)) return;
      registered.add(svgEl);
      d3.select(svgEl).call(t);
    },
    url() { return t.url(); },
  };
}
