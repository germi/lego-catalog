import { useMemo } from "react";

/**
 * One row of the edit modal — a label + an appropriate control widget per prop
 * type (range / checkbox / select / color / color-map / text). Mirrors
 * `vue/EditChartPropControl.vue`.
 */
export function EditChartPropControl({
  propKey,
  value,
  defaultValue,
  hint,
  isOverridden,
  onSet,
  onReset,
}) {
  // Decide which control widget to render.
  const control = useMemo(() => {
    if (hint?.type === "color")     return "color";
    if (hint?.type === "color-map") return "color-map";
    if (Array.isArray(hint?.options)) return "enum";

    const sample = defaultValue ?? value;
    if (typeof sample === "number") return "number";
    if (typeof sample === "boolean") return "boolean";
    if (typeof sample === "string") {
      if (sample.startsWith("#") && sample.length <= 9) return "color";
      return "string";
    }
    if (hint && (hint.min !== undefined || hint.max !== undefined)) return "number";
    return "fallback";
  }, [hint, value, defaultValue]);

  const numRange = {
    min:  hint?.min  ?? 0,
    max:  hint?.max  ?? 100,
    step: hint?.step ?? 1,
  };

  const numericValue =
    typeof value === "number" ? value :
    typeof defaultValue === "number" ? defaultValue :
    numRange.min;

  const decimals = (String(numRange.step).split(".")[1] || "").length;
  const toNumber = (s) => Number(Number(s).toFixed(decimals));
  const formatNumber = (n) => (decimals ? n.toFixed(decimals) : String(n));

  const colorValue =
    typeof value === "string" && value.startsWith("#") ? value : "#000000";

  const setColorMapKey = (k, newColor) =>
    onSet({ ...(value ?? {}), [k]: newColor });

  const unsupportedLabel = useMemo(() => {
    const v = value ?? defaultValue;
    if (typeof v === "function") return "function";
    if (Array.isArray(v)) return `array (${v.length})`;
    if (v && typeof v === "object") return "object";
    return v === null ? "null" : "—";
  }, [value, defaultValue]);

  return (
    <div className="sc-prop-row">
      <label className="sc-prop-label">
        <span className="sc-prop-name">{propKey}</span>
        {isOverridden && (
          <button
            type="button"
            className="sc-prop-reset"
            title="Reset to default"
            onClick={onReset}
          >↺</button>
        )}
      </label>

      <div className="sc-prop-control">
        {control === "number" && (
          <>
            <input
              type="range"
              min={numRange.min}
              max={numRange.max}
              step={numRange.step}
              value={numericValue}
              onChange={(e) => onSet(toNumber(e.target.value))}
            />
            <span className="sc-prop-value">
              {formatNumber(numericValue)}
              {hint?.unit && <span className="sc-prop-unit">{hint.unit}</span>}
            </span>
          </>
        )}

        {control === "boolean" && (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onSet(e.target.checked)}
          />
        )}

        {control === "enum" && (
          <select
            value={value ?? ""}
            onChange={(e) => onSet(e.target.value)}
          >
            {hint.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {control === "color" && (
          <>
            <input
              type="color"
              value={colorValue}
              onChange={(e) => onSet(e.target.value)}
            />
            <input
              type="text"
              className="sc-prop-text"
              defaultValue={value ?? ""}
              placeholder="—"
              onBlur={(e) => onSet(e.target.value || null)}
            />
          </>
        )}

        {control === "color-map" && (
          <div className="sc-color-map">
            {Object.keys(value ?? {}).map((k) => {
              const v = value[k];
              const hex = typeof v === "string" && v.startsWith("#") ? v : "#000000";
              return (
                <label key={k} className="sc-color-map-row">
                  <span>{k}</span>
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => setColorMapKey(k, e.target.value)}
                  />
                </label>
              );
            })}
          </div>
        )}

        {control === "string" && (
          <input
            type="text"
            className="sc-prop-text"
            defaultValue={value ?? ""}
            onBlur={(e) => onSet(e.target.value)}
          />
        )}

        {control === "fallback" && (
          <span className="sc-prop-unsupported">{unsupportedLabel}</span>
        )}
      </div>
    </div>
  );
}

export default EditChartPropControl;
