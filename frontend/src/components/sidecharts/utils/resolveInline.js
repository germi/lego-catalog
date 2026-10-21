/**
 * Resolves a logical inline edge ("start" | "end") to its physical equivalent
 * ("left" | "right") given the reading direction. Physical values pass through.
 *
 *   rtl: false  →  start → left,  end → right
 *   rtl: true   →  start → right, end → left
 */
export function resolveInline(edge, rtl) {
  if (edge === "start") return rtl ? "right" : "left";
  if (edge === "end")   return rtl ? "left"  : "right";
  return edge; // "left", "right", "top", "bottom" — physical pass-through
}

/**
 * Resolves a spacing object (margin / padding) that may use logical "start"/"end"
 * keys to a physical {top, right, bottom, left} object.
 *
 * Rules:
 *   - Explicit "left" / "right" keys are honored as physical (never swapped).
 *   - "start" / "end" keys are resolved via rtl: true swaps them.
 *   - When both physical and logical are present, physical wins.
 *   - Missing keys default to 0.
 *   - rtl: false is identity — {left,right,top,bottom} passes through unchanged.
 */
export function resolveSpacing(spacing, rtl) {
  const hasLogical = "start" in spacing || "end" in spacing;
  const startVal   = spacing.start ?? 0;
  const endVal     = spacing.end   ?? 0;
  return {
    top:    spacing.top    ?? 0,
    bottom: spacing.bottom ?? 0,
    left:   spacing.left   ?? (hasLogical && rtl ? endVal   : startVal),
    right:  spacing.right  ?? (hasLogical && rtl ? startVal : endVal),
  };
}
