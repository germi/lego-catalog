/**
 * Closed-form linear regression with an optional confidence band.
 *
 * Zero external deps (no d3-regression).  Used by RefLineLayer
 * (`rule: "regression"`) and RefAreaLayer (`rule: "regressionCI"`).
 *
 *   const r = linearRegression(data, { x: d => d.x, y: d => d.y });
 *   r.a          // slope
 *   r.b          // intercept
 *   r.rSquared
 *   r.line       // [[xMin, yMin], [xMax, yMax]] — endpoints across domain
 *   r.band       // [{x, y0, y1}, ...] — CI samples (only if data ≥ 3 pts)
 *   r.predict(x) // y-hat at x
 *
 * For the CI we use the formula for the mean response confidence interval
 * around the regression line:
 *
 *   y_hat(x) ± t * s_e * sqrt(1/n + (x - mean_x)^2 / Sxx)
 *
 *   s_e = sqrt(SS_res / (n - 2))         standard error of estimate
 *   Sxx = sum((x_i - mean_x)^2)
 *   t   = critical t-value at (n-2) df for the requested confidence level
 *
 * The t-table is interpolated from a handful of anchor points — accurate
 * enough for the visual band; not meant for statistical reporting.
 */

// Critical t-values for two-sided CIs at common confidence levels, keyed by
// degrees of freedom.  Anchor df values; we linearly interpolate between.
const T_TABLE = {
  0.90: { 1: 6.31,  2: 2.92,  5: 2.02,  10: 1.81,  20: 1.72,  30: 1.70,  60: 1.67,  120: 1.66,  Infinity: 1.645 },
  0.95: { 1: 12.71, 2: 4.30,  5: 2.57,  10: 2.23,  20: 2.09,  30: 2.04,  60: 2.00,  120: 1.98,  Infinity: 1.96  },
  0.99: { 1: 63.66, 2: 9.92,  5: 4.03,  10: 3.17,  20: 2.85,  30: 2.75,  60: 2.66,  120: 2.62,  Infinity: 2.576 },
};

function tCritical(df, ci) {
  if (df <= 0) return 0;
  const row = T_TABLE[ci] ?? T_TABLE[0.95];
  const anchors = Object.keys(row).map(Number).sort((a, b) => a - b);
  // Find the interval [lo, hi] in anchors that brackets df, then interpolate.
  let lo = anchors[0];
  let hi = anchors[anchors.length - 1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (df >= anchors[i] && df <= anchors[i + 1]) {
      lo = anchors[i];
      hi = anchors[i + 1];
      break;
    }
    if (df > anchors[i + 1]) lo = anchors[i + 1];
  }
  if (df >= anchors[anchors.length - 1]) return row[Infinity];
  if (df <= anchors[0]) return row[anchors[0]];
  const tLo = row[lo];
  const tHi = row[hi];
  const f = (df - lo) / (hi - lo);
  return tLo + f * (tHi - tLo);
}

export function linearRegression(data, {
  x       = (d) => d.x,
  y       = (d) => d.y,
  domain  = null,
  ci      = 0.95,
  samples = 60,
} = {}) {
  const xs = [];
  const ys = [];
  for (const d of data ?? []) {
    const xv = +x(d);
    const yv = +y(d);
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      xs.push(xv);
      ys.push(yv);
    }
  }
  const n = xs.length;
  if (n < 2) {
    return { a: 0, b: 0, rSquared: 0, line: null, band: [], predict: () => 0 };
  }

  // Means
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Sxx, Sxy
  let Sxx = 0;
  let Sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    Sxx += dx * dx;
    Sxy += dx * (ys[i] - meanY);
  }
  const a = Sxx === 0 ? 0 : Sxy / Sxx;
  const b = meanY - a * meanX;
  const predict = (xv) => a * xv + b;

  // R²
  let SSres = 0;
  let SStot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = predict(xs[i]);
    SSres += (ys[i] - yHat) ** 2;
    SStot += (ys[i] - meanY) ** 2;
  }
  const rSquared = SStot === 0 ? 0 : 1 - SSres / SStot;

  // Domain across which to draw the line + CI band.  Default = data extent.
  let xMin, xMax;
  if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1])) {
    [xMin, xMax] = domain;
  } else {
    xMin = xs[0]; xMax = xs[0];
    for (let i = 1; i < n; i++) {
      if (xs[i] < xMin) xMin = xs[i];
      if (xs[i] > xMax) xMax = xs[i];
    }
  }

  const line = [[xMin, predict(xMin)], [xMax, predict(xMax)]];

  // Multi-point sampling of the regression — used to render the line as
  // an SVG `<path>` so it follows non-linear axes (log / pow / sqrt)
  // correctly.  On a linear x-axis the N points are colinear and the
  // path is visually identical to a 2-point `<line>`; on log etc. the
  // path traces the actual curve.
  const N = Math.max(2, samples | 0);
  const linePoints = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const xv = xMin + (xMax - xMin) * t;
    linePoints.push({ x: xv, y: predict(xv) });
  }

  // Confidence band requires n ≥ 3 (need df = n - 2 ≥ 1 for s_e).
  let band = [];
  if (n >= 3 && Sxx > 0) {
    const df = n - 2;
    const sE = Math.sqrt(SSres / df);
    const tStar = tCritical(df, ci);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const xv = xMin + (xMax - xMin) * t;
      const yHat = predict(xv);
      const se = sE * Math.sqrt(1 / n + ((xv - meanX) ** 2) / Sxx);
      const half = tStar * se;
      band.push({ x: xv, y0: yHat - half, y1: yHat + half });
    }
  }

  return { a, b, rSquared, line, linePoints, band, predict };
}
