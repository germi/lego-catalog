import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditChartPropControl } from "./EditChartPropControl.jsx";

// ── Stylesheet injection ─────────────────────────────────────────────────────
// Mirrors the scoped CSS in `vue/EditChart.vue` / `EditChartPropControl.vue`.
// Injected once per page when EditChart is first used.
const STYLESHEET = `
.sc-editchart-pencil { position: absolute; top: 6px; left: 6px; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border-radius: 6px;
  border: 1px solid #d97706; background: #fef3c7; color: #92400e;
  cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.sc-editchart-pencil:hover { background: #fde68a; }
.sc-editchart-backdrop { position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: flex-end;
  padding: 24px; pointer-events: none; }
.sc-editchart-modal { pointer-events: auto; background: white; border-radius: 8px;
  width: min(420px, 90vw); max-height: calc(100vh - 48px);
  display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  border: 1px solid #e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px; }
.sc-editchart-header { display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
.sc-editchart-header h2 { margin: 0; font-size: 14px; font-weight: 600; }
.sc-editchart-close { background: none; border: none; font-size: 22px; line-height: 1;
  cursor: pointer; color: #6b7280; }
.sc-editchart-body { overflow-y: auto; padding: 8px 16px 16px; flex: 1; }
.sc-editchart-body section { margin-top: 12px; }
.sc-editchart-body h3 { margin: 0 0 6px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
.sc-editchart-footer { display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-top: 1px solid #e5e7eb; }
.sc-editchart-btn { padding: 6px 12px; border: 1px solid #d1d5db; background: white;
  border-radius: 6px; cursor: pointer; font-size: 12px; }
.sc-editchart-btn:hover { background: #f3f4f6; }
.sc-editchart-btn.primary { background: #2563eb; color: white; border-color: #2563eb; }
.sc-editchart-btn.primary:hover { background: #1d4ed8; }
.sc-editchart-copied { font-size: 11px; color: #059669; }
.sc-editchart-explode { display: flex; align-items: center; gap: 5px;
  margin-right: auto; font-size: 12px; color: #374151; cursor: pointer; user-select: none; }
.sc-editchart-explode input { cursor: pointer; }
.sc-prop-row { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
.sc-prop-label { flex: 0 0 130px; display: flex; align-items: center; gap: 4px; }
.sc-prop-name { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: #374151; }
.sc-prop-reset { border: none; background: none; color: #d97706; font-size: 14px;
  cursor: pointer; line-height: 1; padding: 0 2px; }
.sc-prop-control { flex: 1; display: flex; align-items: center; gap: 8px; }
.sc-prop-control input[type="range"] { flex: 1; }
.sc-prop-value { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px;
  min-width: 48px; text-align: right; color: #111827; }
.sc-prop-unit { color: #9ca3af; margin-left: 2px; }
.sc-prop-text { flex: 1; padding: 3px 6px; border: 1px solid #d1d5db;
  border-radius: 4px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace; }
.sc-prop-control select { flex: 1; padding: 3px 6px; border: 1px solid #d1d5db;
  border-radius: 4px; font-size: 12px; }
.sc-prop-control input[type="color"] { width: 32px; height: 24px; border: 1px solid #d1d5db;
  border-radius: 4px; padding: 0; cursor: pointer; }
.sc-prop-unsupported { font-style: italic; color: #9ca3af; font-size: 11px; }
.sc-color-map { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.sc-color-map-row { display: flex; align-items: center; justify-content: space-between;
  gap: 8px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: #374151; }
`;

let _styleInjected = false;
function ensureStylesheet() {
  if (_styleInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.setAttribute("data-sc-editchart", "");
  el.textContent = STYLESHEET;
  document.head.appendChild(el);
  _styleInjected = true;
}

// ── Explode-layers DOM logic (mirrors EditChart.vue) ─────────────────────────
const SVG_NS      = "http://www.w3.org/2000/svg";
const FRAME_CLASS = "sc-explode-frame";
const GAP_X = 26; // px left per layer (diagonal stack, bottom-left)
const GAP_Y = 20;

function getSvgFrom(rootEl) {
  return rootEl?.closest(".ot-canvas")?.querySelector("svg") ?? null;
}
function getLayerGroups(svg) {
  if (!svg) return [];
  const inner = svg.querySelector(":scope > g");
  const out = [];
  if (inner) out.push(...[...inner.children].filter((n) => n.tagName === "g"));
  out.push(...[...svg.children].filter((n) => n.tagName === "g" && n !== inner));
  return out;
}

/**
 * EditChart — React port. Mirrors `vue/EditChart.vue`.
 *
 * Props:
 *   - effective:  current effective values { key: value, … }
 *   - defaults:   the preset's *_CHART_DEFAULTS
 *   - meta:       optional *_CHART_META — { sections, props: { key: { type, min, max, step, options, unit, skip } } }
 *   - overrides:  current overrides object (for the "is overridden" indicator)
 *   - onSet:      (key, value) => void
 *   - onReset:    (key) => void
 *   - onResetAll: () => void
 */
export function EditChart({
  effective,
  defaults,
  meta = null,
  overrides,
  onSet,
  onReset,
  onResetAll,
}) {
  const [open,    setOpen]    = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [explode, setExplode] = useState(false);
  const rootRef = useRef(null);
  const explodeRef = useRef(false);
  explodeRef.current = explode;

  useEffect(() => { ensureStylesheet(); }, []);

  // Group props into sections defined by meta.sections, with anything missing
  // dropped into "other". Skipped props (meta.props.x.skip === true) are
  // filtered out entirely.
  const groupedSections = useMemo(() => {
    const skipped = new Set(
      Object.entries(meta?.props ?? {})
        .filter(([, v]) => v?.skip)
        .map(([k]) => k),
    );
    const allKeys = Object.keys(defaults).filter((k) => !skipped.has(k));

    const result = {};
    const sections = meta?.sections ?? null;
    if (sections) {
      const seen = new Set();
      for (const [name, keys] of Object.entries(sections)) {
        const filtered = keys.filter((k) => allKeys.includes(k));
        if (filtered.length) result[name] = filtered;
        filtered.forEach((k) => seen.add(k));
      }
      const leftover = allKeys.filter((k) => !seen.has(k));
      if (leftover.length) result.other = leftover;
    } else {
      result.props = allKeys;
    }
    return result;
  }, [meta, defaults]);

  const copyJson = () => {
    const json = JSON.stringify(overrides, null, 2);
    navigator.clipboard?.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Explode-layers effect ──────────────────────────────────────────────────
  useEffect(() => {
    const svg = getSvgFrom(rootRef.current);
    if (!svg) return;
    if (explode) {
      svg.style.overflow = "visible";
      getLayerGroups(svg).forEach((g, i) => {
        g.style.transition = "transform .45s cubic-bezier(.4,0,.2,1)";
        g.style.transform  = `translate(${i * -GAP_X}px, ${i * GAP_Y}px)`;
        g.querySelectorAll(`rect.${FRAME_CLASS}`).forEach((r) => r.remove());
        let box = null;
        try { box = g.getBBox(); } catch { /* not laid out */ }
        if (box && box.width > 0 && box.height > 0) {
          const pad = 4;
          const r = document.createElementNS(SVG_NS, "rect");
          r.setAttribute("class", FRAME_CLASS);
          r.setAttribute("x", box.x - pad);
          r.setAttribute("y", box.y - pad);
          r.setAttribute("width",  box.width  + pad * 2);
          r.setAttribute("height", box.height + pad * 2);
          r.setAttribute("rx", "3");
          r.setAttribute("fill",   "rgba(37,99,235,0.05)");
          r.setAttribute("stroke", "rgba(37,99,235,0.55)");
          r.setAttribute("stroke-width", "1");
          r.setAttribute("pointer-events", "none");
          g.insertBefore(r, g.firstChild);
        }
      });
    } else {
      const groups = getLayerGroups(svg);
      groups.forEach((g) => { g.style.transform = "translate(0px, 0px)"; });
      const t = setTimeout(() => {
        if (explodeRef.current) return; // re-toggled during settle
        groups.forEach((g) => {
          g.style.transform  = "";
          g.style.transition = "";
          g.querySelectorAll(`rect.${FRAME_CLASS}`).forEach((r) => r.remove());
        });
        svg.style.overflow = "";
      }, 480);
      return () => clearTimeout(t);
    }
  }, [explode]);

  return (
    <div className="sc-editchart" ref={rootRef}>
      <button
        type="button"
        className="sc-editchart-pencil"
        title="Edit chart props"
        onClick={() => setOpen(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="sc-editchart-backdrop">
          <div className="sc-editchart-modal" role="dialog">
            <header className="sc-editchart-header">
              <h2>Edit chart props</h2>
              <button type="button" className="sc-editchart-close" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="sc-editchart-body">
              {Object.entries(groupedSections).map(([sectionName, propList]) => (
                <section key={sectionName}>
                  <h3>{sectionName}</h3>
                  {propList.map((key) => (
                    <EditChartPropControl
                      key={key}
                      propKey={key}
                      value={effective[key]}
                      defaultValue={defaults[key]}
                      hint={meta?.props?.[key]}
                      isOverridden={key in overrides}
                      onSet={(v) => onSet(key, v)}
                      onReset={() => onReset(key)}
                    />
                  ))}
                </section>
              ))}
            </div>

            <footer className="sc-editchart-footer">
              <label className="sc-editchart-explode" title="Fan the chart's layers apart to inspect them">
                <input
                  type="checkbox"
                  checked={explode}
                  onChange={(e) => setExplode(e.target.checked)}
                />
                Explode layers
              </label>
              <button type="button" className="sc-editchart-btn" onClick={copyJson}>Copy as JSON</button>
              <button type="button" className="sc-editchart-btn" onClick={onResetAll}>Reset all</button>
              <button type="button" className="sc-editchart-btn primary" onClick={() => setOpen(false)}>Close</button>
              {copied && <span className="sc-editchart-copied">copied!</span>}
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default EditChart;
