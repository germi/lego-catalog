import * as d3 from "d3";

/**
 * forceRelax — a 1-D label de-collision pass.
 *
 * Ported from https://observablehq.com/@naitian/force-relax (and the original
 * aztiker LineChart). Given a set of nodes that each want to sit at a target
 * coordinate (typically a screen-y), it nudges them apart just enough that
 * their bounding bands (≈ `radius`) no longer overlap, while staying as close
 * as possible to their target — the classic "end-of-line label" relaxation.
 *
 * The freeze axis is X: every node is pinned to x = 0 (`fx`), so the simulation
 * only moves them along Y. After the ticks settle, the relaxed Y values are
 * re-assigned by RANK rather than taken per-node: the node with the i-th
 * smallest target gets the i-th smallest settled position. This guarantees the
 * output preserves the input ordering (labels never cross), which a raw
 * force layout does not promise.
 *
 * Usage (chainable, d3-style):
 *   const relax = forceRelax().value(d => d.y).radius(16).iterations(120);
 *   const placed = relax(nodes);   // → [{ ...node, relaxed: <y> }, …]
 *
 * @returns a callable `sim(data)` with `.value()/.radius()/.iterations()/
 *   .collideStrength()/.stayStrength()` getter/setters.
 */
export function forceRelax() {
  let valueFn        = (d) => d;
  let radius         = 16;
  let iterations     = 100;
  let collideStrength = 2;
  let stayStrength    = 1;

  function argsort(arr, fn) {
    return arr
      .map((item, index) => [item, index])
      .sort((a, b) => fn(a[0], b[0]))
      .map((d) => d[1]);
  }

  function sim(data) {
    if (!data?.length) return [];
    // Pin x at 0 (fx) so collide only resolves along y; seed y at each target.
    const nodes = data.map((d) => ({ fx: 0, y: valueFn(d) }));
    const force = d3
      .forceSimulation(nodes)
      .force("collide", d3.forceCollide(radius / 2).strength(collideStrength))
      .force("freezedim", d3.forceX(0))
      .force("stayclose", d3.forceY((d) => d.y).strength(stayStrength))
      .stop();

    for (let i = 0; i < iterations; ++i) force.tick();

    // Rank re-assignment: pair the i-th smallest settled y with the i-th
    // smallest target, so the relaxed order matches the input order exactly.
    const settled = nodes.slice().sort((a, b) => d3.ascending(a.y, b.y));
    const byTarget = argsort(data, (a, b) => d3.ascending(valueFn(a), valueFn(b)));
    const out = new Array(data.length);
    byTarget.forEach((idx, sortedIdx) => {
      out[idx] = { ...data[idx], relaxed: settled[sortedIdx].y };
    });
    return out;
  }

  sim.value = function (v) {
    if (!arguments.length) return valueFn;
    valueFn = v;
    return sim;
  };
  sim.radius = function (v) {
    if (!arguments.length) return radius;
    radius = v;
    return sim;
  };
  sim.iterations = function (v) {
    if (!arguments.length) return iterations;
    iterations = v;
    return sim;
  };
  sim.collideStrength = function (v) {
    if (!arguments.length) return collideStrength;
    collideStrength = v;
    return sim;
  };
  sim.stayStrength = function (v) {
    if (!arguments.length) return stayStrength;
    stayStrength = v;
    return sim;
  };

  return sim;
}
