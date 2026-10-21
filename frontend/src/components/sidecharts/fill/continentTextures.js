import { textures, fromTexture } from "./texture";

/**
 * Pre-built, reusable texture instances — one per continent.
 *
 * Each is a singleton: the same object can be assigned to many countries
 * and BaseMap will only register its <pattern> once (register() is idempotent).
 *
 * Usage:
 *   import { continentTextures } from "@/components/sidecharts/fill/continentTextures"
 *
 *   data = {
 *     USA: { texture: continentTextures.northAmerica },
 *     CAN: { texture: continentTextures.northAmerica },  // same instance, reused
 *     DEU: { texture: continentTextures.europe },
 *     NGA: { texture: continentTextures.africa },
 *   }
 */
export const continentTextures = {
  africa:       fromTexture(textures.circles().fill("#f59e0b").radius(2).size(7).background("#fef3c7")),
  asia:         fromTexture(textures.lines().orientation("diagonal").stroke("#ef4444").size(7).strokeWidth(1.5).background("#fee2e2")),
  europe:       fromTexture(textures.lines().orientation("vertical").stroke("#3b82f6").size(6).strokeWidth(1.5).background("#dbeafe")),
  northAmerica: fromTexture(textures.lines().orientation("3/8").stroke("#8b5cf6").size(7).strokeWidth(1.5).background("#ede9fe")),
  southAmerica: fromTexture(textures.circles().fill("#10b981").radius(2).size(8).background("#d1fae5")),
  oceania:      fromTexture(textures.lines().orientation("horizontal").stroke("#f97316").size(6).strokeWidth(1.5).background("#ffedd5")),
};
