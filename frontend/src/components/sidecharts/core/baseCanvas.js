import * as d3 from "d3";
import { versor } from "../utils/versor.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { domainToTransform } from "../utils/domainToTransform.js";

// Build a ready-to-use `project(d) => [x, y] | null` for a projector, given the
// (already zoom-rescaled) x/y scales it should position through. This is the one
// place projection is assembled: layers consume `payload.project` /
// `payload.prevProject` instead of re-deriving accessor+scale pairings, so every
// layer behaves identically and a new layer just calls one function.
//   • scale projectors pair their OWN accessors with the supplied scales, so the
//     result follows zoom (the scales are already rescaled by the transform);
//   • geo projectors project through their own `fn` — zoom rides the group
//     transform there, not the scales.
function makeProjectFn(projector, xScale, yScale) {
  if (!projector) return () => null;
  if (projector.type === "geo") {
    return (d) => projector.fn?.(d) ?? null;
  }
  const xAcc = projector.xAccessor ?? ((d) => d.x);
  const yAcc = projector.yAccessor ?? ((d) => d.y);
  return (d) => {
    if (!xScale || !yScale) return null;
    const x = xScale(xAcc(d));
    const y = yScale(yAcc(d));
    return isFinite(x) && isFinite(y) ? [x, y] : null;
  };
}

export const BASE_CANVAS_DEFAULTS = {
  adjustSize:      false,
  scale:           0.95,
  projectionType:  "geoMercator",
  maxZoom:         16,
  allowManualZoom: true,
  zoomScale:       1,
  rotateMode:      false,
  northUp:         false,
  duration:        500,
  skipProjection:  false,
  forceSquare:     false,
  clampPan:        false,
  clampPanInset:   null,   // { x, y } px to subtract from each axis of the pan extent
  // Projector system (scatter / XY mode).  The projector is supplied
  // already-fit by the parent chart; the canvas does not build it.
  projector:       null,
  margin:          { top: 0, right: 0, bottom: 0, left: 0 },
  // Surfaced on the draw payload (payload.padding) as data only — layers
  // self-position via `props.padding ?? payload.padding`. innerDims subtracts
  // margin only, so this is a pure passthrough (no behavioral change here).
  padding:         { top: 0, right: 0, bottom: 0, left: 0 },
  ease:            GLOBAL_DEFAULTS.ease,
  // Which axes the canvas's zoom affects.  Layers read this from the draw
  // payload and conditionally rescale x / y on zoom — saves every layer
  // from needing its own per-axis toggle and keeps presets in charge.
  //   "xy"  — 2D zoom (ScatterPlot default).
  //   "x"   — x-only zoom (LineChart, AreaChart, ribbon-style charts).
  //   "y"   — y-only zoom (rare; supported for completeness).
  //   "none"— layers ignore zoom entirely (axes still transition).
  zoomAxes:        "xy",
  // Constrains which axes *user gestures* (wheel, drag) are allowed to move.
  // Defaults to null which means "same as zoomAxes".  Set to "x" when you
  // want user panning to be x-only but programmatic zoomToDomain to be able
  // to set both axes independently (scrollytelling + minimap use case).
  userZoomAxes:    null,
};

export function createBaseCanvas(svgEl, containerEl, opts = {}) {
  const o = { ...BASE_CANVAS_DEFAULTS, ...opts };

  const svg          = d3.select(svgEl);
  let projection     = null;
  let path           = null;
  let zoomBehavior   = null;
  let resizeObserver = null;
  let initialRotateState = null;
  let storedBounds   = null;
  let initialized    = false;
  let _width         = 100;
  let _height        = 100;
  // Tracks the last transform applied programmatically so that user-gesture
  // axis constraints (userZoomAxes) can freeze the locked axis at the
  // programmatic value rather than resetting it to 0.
  let _programmaticTransform = d3.zoomIdentity;
  // Re-entry guard: prevents the constrained-transform re-apply inside the
  // zoom handler from triggering a second pass through the same handler.
  let _applyingConstraint = false;
  // True during the SYNCHRONOUS block of a programmatic cartesian zoom call
  // (setTransform / zoomToDomain / resetZoom / zoomIn / zoomOut /
  // zoomToScale).  We snap the d3-zoom transform inside that block; the
  // listener below short-circuits so layers don't react to the instantaneous
  // jump.  Instead the call follows up with `draw(duration)`, which delivers
  // the post-zoom projector to every layer in ONE event — layers then run
  // their own plain `update.transition().attr(…)` over `duration`, all on
  // the same ease.  See docs/plans/zoom-event-unification-plan.md.
  let _suppressZoomEvent = false;

  // Snapshot of the projector + zoom transform representing the PREVIOUS
  // frame.  Layers read these via `payload.prevXScale` / `payload.prevYScale`
  // (getters, below) to transition entering elements from where they would
  // have been on the previous frame to where they belong now.
  //
  // The snapshot advances to a draw's state only AFTER that draw's animation
  // finishes (deferred by `drawDuration` via `_prevAdvanceTimer`).  This is
  // what makes entering elements slide correctly: while a programmatic zoom is
  // animating, prev stays at the pre-zoom frame, so a rect that appears during
  // the zoom — even via a brand-new layer mounted with v-if — slides in from
  // the old view.  Once the animation settles, prev === current, so a layer
  // activated later fades in place.  See docs/plans/zoom-with-data-change-plan.md.
  let _prevProjector     = null;
  let _prevZoomTransform = d3.zoomIdentity;
  let _prevAdvanceTimer  = null;

  // Coalesces a zoomToDomain call with any Vue / React reactive
  // projector update queued in the same tick.  The transform must be
  // computed against the LIVE projector — see the same plan doc.
  let _pendingZoomDomain = null;
  let _pendingZoomFlush  = null;

  function isCartesianZoom() {
    return !!(o.projector?.raw?.xScale || o.projector?.raw?.yScale);
  }

  // Zoom a band/point scale (one with no `.invert`) by stretching its pixel
  // RANGE with the transform — `rescaleX/Y` can't be used on these scales
  // (they call `scale.invert`, which band/point scales don't have).  This is
  // the same thing RibbonLayer does internally (`activeZoomTransform.applyX`):
  // keep the ordinal domain, move the range endpoints.
  //
  // `rawScale` may be the projector's CENTERED band wrapper
  // (`Object.assign((v)=>band(v)+bw/2, band)` from makeScaleProjector).  `.copy()`
  // returns a plain, un-centered band scale, so we detect whether the input was
  // centered and re-apply the mid-band offset (with the NEW, stretched
  // bandwidth) — otherwise a value that read as the band CENTRE when unzoomed
  // (e.g. a vertical RefLine at a category) would jump to the band's LEFT EDGE
  // the moment the user zooms.
  function _zoomBand(rawScale, applyAxis) {
    const plain = rawScale.copy();                 // un-centered band scale
    const dom   = rawScale.domain();
    const centered = dom.length > 0 &&
      Math.abs(rawScale(dom[0]) - plain(dom[0]) - rawScale.bandwidth() / 2) < 1e-6;
    const [r0, r1] = rawScale.range();
    const zoomed = plain.range([applyAxis(r0), applyAxis(r1)]);
    if (!centered) return zoomed;
    const bw = zoomed.bandwidth();
    return Object.assign((v) => zoomed(v) + bw / 2, zoomed);
  }

  // Apply a d3 zoom transform to a raw scale, honouring `o.zoomAxes`.
  // Returns the rescaled scale, or the original if zoom doesn't apply
  // on that axis.  Used by fireDraw + the future onZoom dispatch to
  // produce ready-to-use `payload.xScale` / `payload.yScale` so layers
  // never have to call `applyZoomToScales` themselves.
  function _zoomedX(rawScale, transform) {
    if (!rawScale) return null;
    if (!transform || transform === d3.zoomIdentity) return rawScale;
    const wantX = o.zoomAxes === "xy" || o.zoomAxes === "x";
    if (!wantX) return rawScale;
    return typeof rawScale.invert === "function"
      ? transform.rescaleX(rawScale)
      : _zoomBand(rawScale, (v) => transform.applyX(v));
  }
  function _zoomedY(rawScale, transform) {
    if (!rawScale) return null;
    if (!transform || transform === d3.zoomIdentity) return rawScale;
    const wantY = o.zoomAxes === "xy" || o.zoomAxes === "y";
    if (!wantY) return rawScale;
    return typeof rawScale.invert === "function"
      ? transform.rescaleY(rawScale)
      : _zoomBand(rawScale, (v) => transform.applyY(v));
  }

  // Dispatch a rich zoom payload — `{ transform, xScale, yScale }` —
  // so layer cores can consume canvas-rescaled scales directly without
  // calling rescaleX themselves.  Backward compatible: layer cores
  // that haven't migrated yet pull `.transform` off the argument via
  // a small compat shim (`zoomArg?.transform ?? zoomArg`).
  function _dispatchOnZoom(transform) {
    // Interactive (wheel/drag) zoom does NOT fire a draw — it settles
    // continuously as the user gestures — so advance the "previous frame"
    // snapshot to the current view here.  Otherwise a layer activated after a
    // MANUAL zoom would read a stale pre-zoom prev and fly in.  Cancel any
    // deferred programmatic advance: the user has taken over.  (Programmatic
    // zoom suppresses this listener, so the two paths never fight.)
    if (_prevAdvanceTimer) { clearTimeout(_prevAdvanceTimer); _prevAdvanceTimer = null; }
    _prevProjector     = o.projector ?? null;
    _prevZoomTransform = transform;

    if (!o.onZoom) return;
    const rawX = o.projector?.raw?.xScale ?? null;
    const rawY = o.projector?.raw?.yScale ?? null;
    const xScale = _zoomedX(rawX, transform);
    const yScale = _zoomedY(rawY, transform);
    o.onZoom({ transform, xScale, yScale });
  }

  /**
   * Apply a target transform synchronously (no d3-zoom animation) and fire
   * a single draw with the post-zoom projector + duration.  Used by the
   * cartesian branch of every programmatic zoom method.  Geo / rotate
   * canvases keep their existing animated paths (see `canRotate()` branches
   * and the geo fallback below) — they need d3-zoom's transition because
   * they animate via the SVG group transform, not by re-rendering paths.
   */
  function _applyTransformAndDraw(target, duration) {
    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[baseCanvas] _applyTransformAndDraw", {
        targetK: target.k, targetX: target.x, targetY: target.y, duration,
      });
    }
    _programmaticTransform = target;
    _suppressZoomEvent = true;
    svg.call(zoomBehavior.transform, target);
    _suppressZoomEvent = false;
    draw(duration);
  }

  // Microtask runner for zoomToDomain.  Reads `o.projector` AFTER any
  // queued reactive projector update has flushed, computes the
  // transform against the live scales, and dispatches it.  See the
  // cartesian branch of zoomToDomain.
  function _applyPendingZoom() {
    _pendingZoomFlush = null;
    const opts = _pendingZoomDomain;
    _pendingZoomDomain = null;
    if (!opts) return;
    const { x, y, padding, duration, ease } = opts;
    const xScale = o.projector?.raw?.xScale ?? null;
    const yScale = o.projector?.raw?.yScale ?? null;
    if (!xScale && !yScale) return;
    const t = domainToTransform(xScale, yScale, { x, y, padding });
    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[baseCanvas] _applyPendingZoom", {
        targetDomainX: x, targetDomainY: y,
        liveXDomain: xScale?.domain?.(),
        computedK: t.k,
      });
    }
    setTransform({ k: t.k, tx: t.x, ty: t.y }, duration, ease);
  }

  // --- PROJECTION ---
  function createProjection() {
    const pt = o.projectionType;
    if (typeof pt === "function") {
      return typeof pt.scale === "function" ? pt : pt();
    }
    const factory = d3[pt];
    if (!factory) {
      console.warn(`[BaseCanvas] Unknown projectionType "${pt}", falling back to geoMercator`);
      return d3.geoMercator().scale(1).translate([0, 0]);
    }
    const proj = factory().scale(1).translate([0, 0]);
    if (pt === "geoIdentity") proj.reflectY(true);
    return proj;
  }

  function fitProjection(fc) {
    projection.scale(1).translate([0, 0]);
    const b = path.bounds(fc);

    if (!o.adjustSize) {
      const aspectRatio = (b[1][0] - b[0][0]) / (b[1][1] - b[0][1]);
      _height = _width / aspectRatio;
    }

    svg.attr("viewBox", `0 0 ${_width} ${_height}`);

    const s = o.scale / Math.max(
      (b[1][0] - b[0][0]) / _width,
      (b[1][1] - b[0][1]) / _height,
    );
    const t = [
      (_width  - s * (b[1][0] + b[0][0])) / 2,
      (_height - s * (b[1][1] + b[0][1])) / 2,
    ];
    projection.scale(s).translate(t);

    if (o.rotateMode && typeof projection.rotate === "function") {
      initialRotateState = { rotation: [...projection.rotate()], scale: projection.scale() };
    }

    // _height may have changed from the aspect-ratio calculation above — sync back to framework.
    o.onResize?.(_width, _height);
  }

  // --- INNER DIMENSIONS (margin-aware) ---
  function innerDims() {
    const m = o.margin;
    return {
      iw: Math.max(0, _width  - m.left - m.right),
      ih: Math.max(0, _height - m.top  - m.bottom),
    };
  }

  // --- DRAW ---
  function fireDraw(drawDuration, extra = {}) {
    const { iw, ih } = innerDims();

    // Live transform reader.  The CURRENT scales are exposed below as getters
    // that call this at access time — NOT snapshotted — so a layer reading the
    // payload at any moment gets the up-to-date zoom-aware scales.  This is the
    // key to "a layer can mount at any zoom and read correct scales": interactive
    // (wheel/drag) zoom updates d3's transform WITHOUT firing a draw, so a frozen
    // snapshot taken here would be stale for a layer that mounts mid-zoom.
    const curTransform = () =>
      (svgEl && zoomBehavior) ? d3.zoomTransform(svgEl) : d3.zoomIdentity;

    // Raw (unzoomed) scales.  These only change when the projector changes,
    // which always fires a fresh draw — so capturing them per-draw is safe;
    // only the TRANSFORM needs to stay live.
    const rawX = o.projector?.raw?.xScale ?? null;
    const rawY = o.projector?.raw?.yScale ?? null;
    // Un-centered (left-edge) band scales for bar/ribbon layers; fall back to
    // the centered scales for continuous projectors (where they're identical).
    const rawXUncentered = o.projector?.raw?.xScaleUncentered ?? rawX;
    const rawYUncentered = o.projector?.raw?.yScaleUncentered ?? rawY;

    const payload = {
      projection,
      projector:   o.projector ?? null,
      svgEl,
      duration:    drawDuration,
      ease:        o.ease,
      // CURRENT zoom-aware scales + transform — LIVE getters (read at access
      // time) so a layer can mount at any zoom and read the correct scales.
      // Treat them like normal d3 scales: `payload.xScale(d.year)`.
      get zoomTransform() { return curTransform(); },
      get xScale()        { return _zoomedX(rawX, curTransform()); },
      get yScale()        { return _zoomedY(rawY, curTransform()); },
      // Un-centered (left-edge) band scales, zoomed — for bar/ribbon layers that
      // position from the band edge + bandwidth(). Identical to xScale/yScale on
      // continuous projectors. _zoomedX/Y leave an un-centered scale un-centered
      // (and a centered one centered), so these stay left-edge under zoom.
      get xScaleUncentered() { return _zoomedX(rawXUncentered, curTransform()); },
      get yScaleUncentered() { return _zoomedY(rawYUncentered, curTransform()); },
      // PREVIOUS-frame scales — LIVE getters over the module-level prev
      // snapshot.  That snapshot is held at the PRE-animation frame until this
      // draw's animation finishes (see the deferred advance below), so an
      // entering element — even one in a layer mounted via v-if mid-zoom —
      // reads the old frame and slides in.  After the animation settles,
      // prev === current, so a layer activated then fades in place.
      get prevXScale() {
        return _prevProjector?.raw?.xScale
          ? _zoomedX(_prevProjector.raw.xScale, _prevZoomTransform)
          : _zoomedX(rawX, curTransform());
      },
      get prevYScale() {
        return _prevProjector?.raw?.yScale
          ? _zoomedY(_prevProjector.raw.yScale, _prevZoomTransform)
          : _zoomedY(rawY, curTransform());
      },
      // The PREVIOUS-frame projector object (accessors + raw scales), held at the
      // pre-animation frame like prevXScale/prevYScale.  Exposed so anything that
      // needs the raw pieces can reach them; most layers want `prevProject`.
      get prevProjector() { return _prevProjector ?? o.projector ?? null; },

      // Ready-to-use projection for THIS frame and the PREVIOUS frame. Each pairs
      // the right projector's own accessors with the right (zoom-rescaled) scales,
      // so a layer never re-derives this. `prevProject` is what an entering
      // element slides FROM / an exiting element travels TO — it reads the prev
      // projector's accessors, so a projector rebuilt with different x/y accessors
      // is handled correctly.
      get project()     { return makeProjectFn(o.projector, this.xScale, this.yScale); },
      get prevProject() { return makeProjectFn(this.prevProjector, this.prevXScale, this.prevYScale); },
      width:       _width,
      height:      _height,
      innerWidth:  iw,
      innerHeight: ih,
      margin:      o.margin,
      padding:     o.padding,
      zoomAxes:    o.zoomAxes,
      ...extra,
    };

    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[baseCanvas] fireDraw", {
        duration: drawDuration,
        zoomK: curTransform().k,
        currXDomain: payload.xScale?.domain?.(),
        prevXDomain: payload.prevXScale?.domain?.(),
      });
    }

    o.onDraw?.(payload);

    // Advance the "previous frame" snapshot to THIS draw's state — but only
    // once the draw's animation has FINISHED, so entering elements during the
    // animation keep sliding from the prior frame.  A subsequent draw cancels
    // and reschedules.  Zero-duration draws (resize, per-frame zoom) advance
    // immediately.
    const thisProjector = o.projector ?? null;
    const thisTransform = curTransform();
    if (_prevAdvanceTimer) { clearTimeout(_prevAdvanceTimer); _prevAdvanceTimer = null; }
    if (drawDuration > 0) {
      _prevAdvanceTimer = setTimeout(() => {
        _prevAdvanceTimer  = null;
        _prevProjector     = thisProjector;
        _prevZoomTransform = thisTransform;
      }, drawDuration);
    } else {
      _prevProjector     = thisProjector;
      _prevZoomTransform = thisTransform;
    }
  }

  function draw(drawDuration) {
    if (!svgEl) return;

    if (o.skipProjection) {
      svg.attr("viewBox", `0 0 ${_width} ${_height}`);
      const currentTransform = svg ? d3.zoomTransform(svg.node()) : d3.zoomIdentity;
      setupZoom(currentTransform);
      fireDraw(drawDuration ?? o.duration);
      return;
    }

    if (!storedBounds?.features?.length) return;

    const prevRotation =
      o.rotateMode && projection && typeof projection.rotate === "function"
        ? [...projection.rotate()]
        : null;
    const prevScale = prevRotation ? projection.scale() : null;

    projection = createProjection();
    path = d3.geoPath().projection(projection);
    fitProjection(storedBounds);

    if (prevRotation) projection.rotate(prevRotation).scale(prevScale);

    const currentTransform = svg ? d3.zoomTransform(svg.node()) : d3.zoomIdentity;
    setupZoom(currentTransform);
    fireDraw(drawDuration ?? o.duration);
  }

  // fitBounds may be called before init() (by child layers whose immediate watchers
  // fire before the parent's onMounted). The initialized flag prevents a premature draw.
  function fitBounds(fc) {
    storedBounds = fc;
    if (initialized && svgEl) draw();
  }

  // --- ROTATE MODE ---
  function canRotate() {
    return o.rotateMode && !!projection && typeof projection.rotate === "function";
  }

  function redrawPaths() {
    if (!projection) return;
    path = d3.geoPath().projection(projection);
    fireDraw(0);
  }

  function setupRotateDrag() {
    svg.on(".zoom", null).on(".drag", null).on("wheel.rotatezoom", null);
    if (!o.allowManualZoom) return;

    let v0, q0, r0, coords0;
    const dragBehavior = d3.drag()
      .on("start", function (event) {
        r0 = projection.rotate();
        if (o.northUp) {
          coords0 = projection.invert([event.x, event.y]);
        } else {
          const coords = projection.invert([event.x, event.y]);
          if (!coords) { v0 = null; return; }
          v0 = versor.cartesian(coords);
          q0 = versor.quat(r0);
        }
      })
      .on("drag", function (event) {
        if (o.northUp) {
          if (!coords0) return;
          const coords1 = projection.rotate(r0).invert([event.x, event.y]);
          if (!coords1) return;
          projection.rotate([
            r0[0] - (coords1[0] - coords0[0]),
            r0[1] - (coords1[1] - coords0[1]),
            0,
          ]);
        } else {
          if (!v0) return;
          const coords = projection.rotate(r0).invert([event.x, event.y]);
          if (!coords) return;
          const v1 = versor.cartesian(coords);
          const delta = versor.delta(v1, v0);
          projection.rotate(versor.rotation(versor.multiply(q0, delta)));
          if (delta[0] < 0.7) {
            v0 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]) ?? coords);
            q0 = versor.quat((r0 = projection.rotate()));
          }
        }
        redrawPaths();
      });

    svg.call(dragBehavior);

    svg.on("wheel.rotatezoom", function (event) {
      event.preventDefault();
      const fitScale = initialRotateState?.scale ?? projection.scale();
      const delta = event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      const factor = Math.pow(2, -delta);
      projection.scale(Math.max(fitScale, Math.min(fitScale * o.maxZoom, projection.scale() * factor)));
      redrawPaths();
    });
  }

  function animateRotation(targetRotation, targetScale, duration = o.duration) {
    if (!canRotate() || !svg) return;
    const r0 = [...projection.rotate()];
    const s0 = projection.scale();
    const ri = versor.interpolate(r0, targetRotation);
    const si = d3.interpolate(s0, targetScale);
    svg.transition("canvas-zoom").duration(duration).tween("rotate-feature", () => (t) => {
      projection.rotate(ri(t)).scale(si(t));
      redrawPaths();
    });
  }

  // --- ZOOM ---
  // Resolve the pan-clamp box for d3-zoom. The zoom transform is applied to the
  // projector's scales, which live in INNER-EL coordinates (the range already
  // excludes the margin — the margin is the innerEl group's own translate,
  // OUTSIDE the transform). So the clamp box must be in innerEl coords too, with
  // NO margin in it. Two shapes for clampPanInset:
  //   • full rect { left, right, top, bottom } — per-side PADDING inset within
  //     the plot: box = [[pad.left, pad.top], [iw - pad.right, ih - pad.bottom]]
  //     where iw/ih are the inner (margin-subtracted) dims. Positions the box on
  //     the actual data area, so pan is symmetric even with asymmetric margins.
  //   • legacy sums { x, y } — origin-anchored [[0,0],[W-x, H-y]].
  // extent === translateExtent (both = this box) so identity is preserved at
  // k=1 (a translateExtent smaller than the extent would centre the content).
  function clampPanBox() {
    const inset = o.clampPanInset ?? {};
    const hasSides = inset.left != null || inset.right != null
                  || inset.top  != null || inset.bottom != null;
    if (hasSides) {
      const m  = o.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const iw = _width  - (m.left ?? 0) - (m.right  ?? 0);
      const ih = _height - (m.top  ?? 0) - (m.bottom ?? 0);
      const x0 = inset.left ?? 0;
      const y0 = inset.top  ?? 0;
      const x1 = iw - (inset.right  ?? 0);
      const y1 = ih - (inset.bottom ?? 0);
      return [[x0, y0], [Math.max(x0 + 1, x1), Math.max(y0 + 1, y1)]];
    }
    const x1 = _width  - (inset.x ?? 0);
    const y1 = _height - (inset.y ?? 0);
    return [[0, 0], [Math.max(1, x1), Math.max(1, y1)]];
  }

  function applyClampPan() {
    if (!o.clampPan || !zoomBehavior) return;
    const box = clampPanBox();
    zoomBehavior.extent(box).translateExtent(box);
  }

  function setClampPanInset(inset) {
    o.clampPanInset = inset;
    applyClampPan();
  }

  function setClampPan(value) {
    o.clampPan = value;
    if (zoomBehavior) {
      if (value) {
        applyClampPan();
      } else {
        // Remove extent constraints so all pan positions are allowed.
        zoomBehavior
          .extent([[0, 0], [_width, _height]])
          .translateExtent([[-Infinity, -Infinity], [Infinity, Infinity]]);
      }
    }
  }

  function setupZoom(currentTransform) {
    if (canRotate()) { setupRotateDrag(); return; }
    zoomBehavior = d3.zoom().scaleExtent([1, o.maxZoom]).on("zoom", (event) => {
      if (_applyingConstraint) return;

      // Programmatic cartesian zoom snaps the transform synchronously and
      // then dispatches a single draw with the post-zoom scales (see
      // `_applyTransformAndDraw`).  Suppress this listener for the
      // duration of that synchronous block — layers will pick up the new
      // state via the draw event, NOT via a per-frame zoom event.
      if (_suppressZoomEvent) {
        _programmaticTransform = event.transform;
        return;
      }

      // d3-zoom fires the same "zoom" handler for user gestures AND for
      // programmatic transitions (setTransform / zoomToDomain / resetZoom /
      // …).  Distinguish them via event.sourceEvent — set for user input
      // (MouseEvent, WheelEvent, TouchEvent), undefined for transitions.
      const isUserGesture = !!event.sourceEvent;

      // Keep _programmaticTransform in sync with whatever non-user code
      // last drove the zoom (including in-flight transition frames).  This
      // means resetZoom / zoomIn / zoomOut all leave a coherent baseline
      // for the user-gesture constraint below.
      if (!isUserGesture) _programmaticTransform = event.transform;

      const userAxes = o.userZoomAxes ?? o.zoomAxes;

      // The axis-constraint logic ONLY applies to user gestures.  Without
      // this guard, the constraint would freeze the locked axis at its
      // final programmatic value during every transition frame — y "snaps"
      // instead of interpolating.
      if (isUserGesture && userAxes !== "xy") {
        const t = event.transform;
        let constrained = t;

        if (userAxes === "x") {
          constrained = d3.zoomIdentity
            .translate(t.x, _programmaticTransform.y)
            .scale(t.k);
        } else if (userAxes === "y") {
          constrained = d3.zoomIdentity
            .translate(_programmaticTransform.x, t.y)
            .scale(t.k);
        } else if (userAxes === "none") {
          return; // ignore user gestures entirely
        }

        if (constrained !== t) {
          _applyingConstraint = true;
          svg.call(zoomBehavior.transform, constrained);
          _applyingConstraint = false;
          _dispatchOnZoom(constrained);
          return;
        }
      }

      _dispatchOnZoom(event.transform);
    });
    // Gesture lifecycle — only USER gestures carry a sourceEvent (programmatic
    // zoom.transform does not), so these fire on wheel/drag start/end only.
    zoomBehavior
      .on("start", (event) => { if (event.sourceEvent && o.onZoomStart) o.onZoomStart(event); })
      .on("end",   (event) => { if (event.sourceEvent && o.onZoomEnd)   o.onZoomEnd(event); });
    applyClampPan();
    svg.call(zoomBehavior);
    if (!o.allowManualZoom) svg.on(".zoom", null);
    // Re-apply the current transform to the new behavior so future user
    // gestures start from the right baseline.  Suppress the zoom listener
    // for this synthetic application — the draw that immediately follows
    // (via fireDraw) will deliver the correct rescaled scales via
    // payload.xScale / payload.yScale.  Without the suppress, layers that
    // watch zoomSignal receive an extra duration:0 render here, snapping
    // animated transitions to their final position before they can play.
    const notIdentity =
      currentTransform.k !== 1 ||
      currentTransform.x !== 0 ||
      currentTransform.y !== 0;
    if (notIdentity) {
      _suppressZoomEvent = true;
      svg.call(zoomBehavior.transform, currentTransform);
      _suppressZoomEvent = false;
    }
  }

  function _transition(duration, ease) {
    const tr = svg.transition("canvas-zoom").duration(duration);
    if (!ease) return tr;
    // Allow callers to pass either a d3 ease function or a d3 ease name
    // (e.g. "easeCubicInOut", "easeLinear").  Unknown names silently fall
    // back to d3's default (easeCubic) instead of throwing.
    const fn = typeof ease === "function" ? ease : d3[ease];
    return fn ? tr.ease(fn) : tr;
  }

  // --- PUBLIC ZOOM METHODS ---
  function zoomToRect([[x0, y0], [x1, y1]], duration = o.duration, ease = null) {
    if (!svg || !zoomBehavior) return;
    const target = d3.zoomIdentity
      .translate(_width / 2, _height / 2)
      .scale(Math.min(o.maxZoom, o.scale / Math.max((x1 - x0) / _width, (y1 - y0) / _height)))
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    if (isCartesianZoom()) {
      _applyTransformAndDraw(target, duration);
    } else {
      _transition(duration, ease).call(zoomBehavior.transform, target);
    }
  }

  function zoomToScale(scale, duration = o.duration, ease = null) {
    if (canRotate()) {
      const fitScale = initialRotateState?.scale ?? projection.scale();
      if (scale <= 1) { resetZoom(duration); return; }
      const s0 = projection.scale();
      const s1 = fitScale * scale;
      const si = d3.interpolate(s0, s1);
      svg.transition("canvas-zoom").duration(duration).tween("zoom-scale", () => (tt) => {
        projection.scale(si(tt)); redrawPaths();
      });
      return;
    }
    if (!svg || !zoomBehavior) return;
    if (isCartesianZoom()) {
      // Compute the target transform and dispatch through the unified path
      // so layers see a single draw + duration.  For scaleTo at a fixed
      // center, the equivalent transform keeps tx/ty of current * scale.
      if (scale <= 1) {
        _applyTransformAndDraw(d3.zoomIdentity, duration);
      } else {
        const t = _programmaticTransform;
        const target = d3.zoomIdentity.translate(t.x, t.y).scale(scale);
        _applyTransformAndDraw(target, duration);
      }
    } else {
      if (scale <= 1) _transition(duration, ease).call(zoomBehavior.transform, d3.zoomIdentity);
      else            _transition(duration, ease).call(zoomBehavior.scaleTo, scale);
    }
  }

  function resetZoom(duration = o.duration, ease = null) {
    if (canRotate() && initialRotateState) {
      const r0 = projection.rotate();
      const s0 = projection.scale();
      const ri = d3.interpolate(r0, initialRotateState.rotation);
      const si = d3.interpolate(s0, initialRotateState.scale);
      svg.transition("canvas-zoom").duration(duration).tween("reset-rotate", () => (tt) => {
        projection.rotate(ri(tt)).scale(si(tt));
        redrawPaths();
      });
      return;
    }
    if (!svg || !zoomBehavior) return;
    if (isCartesianZoom()) {
      _applyTransformAndDraw(d3.zoomIdentity, duration);
    } else {
      _programmaticTransform = d3.zoomIdentity;
      _transition(duration, ease).call(zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  // Scale the cartesian transform by `factor` about the VIEWPORT CENTRE rather
  // than the data origin, so button zoom feels like wheel zoom — the middle of
  // what you're currently looking at stays put.  This mirrors d3-zoom's
  // scaleBy-about-a-point math, which the geo path gets for free from
  // zoomBehavior.scaleBy (it defaults the pivot to the extent centroid).
  //
  //   p1 = t.invert(centre)              data point currently under the centre
  //   t' = translate(scale(t, k1), centre, p1)   keep it under the centre after
  //
  // Read the LIVE transform from d3-zoom (`svg.__zoom`), NOT
  // `_programmaticTransform` — the latter is only synced on programmatic zoom
  // (see the `if (!isUserGesture)` guard in the zoom handler), so after a manual
  // pan it's stale and the zoom would snap back to the old centre.  d3's own
  // state tracks user pans AND programmatic transforms, so it's always current.
  function _cartesianScaleBy(factor, duration) {
    const t  = d3.zoomTransform(svg.node());
    const k1 = Math.max(1, Math.min(o.maxZoom, t.k * factor));
    const cx = _width / 2, cy = _height / 2;
    const p1x = (cx - t.x) / t.k;
    const p1y = (cy - t.y) / t.k;
    const target = constrainTransform(
      d3.zoomIdentity.translate(cx - p1x * k1, cy - p1y * k1).scale(k1),
    );
    _applyTransformAndDraw(target, duration);
  }

  function zoomIn(duration = o.duration, ease = null) {
    if (canRotate()) {
      const fitScale = initialRotateState?.scale ?? projection.scale();
      const s0 = projection.scale();
      const s1 = Math.min(fitScale * o.maxZoom, s0 * 2);
      const si = d3.interpolate(s0, s1);
      svg.transition().duration(duration).tween("zoom-in", () => (tt) => {
        projection.scale(si(tt)); redrawPaths();
      });
      return;
    }
    if (!svg || !zoomBehavior) return;
    if (isCartesianZoom()) {
      _cartesianScaleBy(2, duration);
    } else {
      _transition(duration, ease).call(zoomBehavior.scaleBy, 2);
    }
  }

  function zoomOut(duration = o.duration, ease = null) {
    if (canRotate()) {
      const fitScale = initialRotateState?.scale ?? projection.scale();
      const s0 = projection.scale();
      const s1 = Math.max(fitScale, s0 / 2);
      const si = d3.interpolate(s0, s1);
      svg.transition().duration(duration).tween("zoom-out", () => (tt) => {
        projection.scale(si(tt)); redrawPaths();
      });
      return;
    }
    if (!svg || !zoomBehavior) return;
    if (isCartesianZoom()) {
      _cartesianScaleBy(0.5, duration);
    } else {
      _transition(duration, ease).call(zoomBehavior.scaleBy, 0.5);
    }
  }

  // --- PROGRAMMATIC ZOOM (data-space) ---

  /**
   * Apply an exact d3 zoom transform with optional animation.
   * Fires onZoom normally so all descendant layers respond.
   *
   * @param {{ k: number, tx: number, ty: number }} t
   * @param {number} [duration]
   * @param {string|null} [ease]
   */
  // When clampPan is on, run a programmatic transform through d3-zoom's own
  // constrain so it respects the SAME translateExtent that interactive pans do.
  // (zoom.transform bypasses translateExtent, so without this a zoomToDomain /
  // zoomToIds could show area beyond the data borders. Clamping here means a
  // selection near an edge lands clamped to that border — i.e. NOT centred —
  // which is the intended "never pan past the data" behaviour.)
  function constrainTransform(t) {
    if (!o.clampPan || !zoomBehavior) return t;
    return zoomBehavior.constrain()(t, clampPanBox(), zoomBehavior.translateExtent());
  }

  function setTransform({ k = 1, tx = 0, ty = 0 } = {}, duration = o.duration, ease = null) {
    if (!svg || !zoomBehavior) return;
    const target = constrainTransform(d3.zoomIdentity.translate(tx, ty).scale(k));
    if (isCartesianZoom()) {
      // Cartesian: snap the transform, fire one draw with the post-zoom
      // projector + duration.  Each layer animates via its own
      // `update.transition().attr(…)` on the same ease.
      _applyTransformAndDraw(target, duration);
    } else {
      // Geo (non-rotate): keep d3-zoom's animated transition — the geo
      // group rides this transform directly, no per-layer re-projection.
      _programmaticTransform = target;
      _transition(duration, ease).call(zoomBehavior.transform, target);
    }
  }

  /**
   * Zoom to a data-space domain on one or both axes with optional animation.
   *
   * For cartesian charts (have a projector with raw scales) the domain is
   * converted via the scale's pixel mapping.  For geo canvases (have a
   * D3 geo projection but no projector) x/y are treated as [lon0,lon1] /
   * [lat0,lat1] and converted to SVG pixel coords via projection().
   *
   * @param {{ x?: [any,any], y?: [any,any], padding?: number }} opts
   * @param {number} [duration]
   * @param {string|null} [ease]
   */
  function zoomToDomain({ x, y, padding = 0 } = {}, duration = o.duration, ease = null) {
    if (!x && !y) return;

    // --- Cartesian mode (projector with raw scales) ---
    //
    // Defer the transform computation to the next microtask so any
    // Vue / React reactive projector update queued in the same click
    // handler (e.g. `bandToggled = true` immediately before this call)
    // flushes first.  The transform must be computed against the LIVE
    // projector — otherwise `(k, tx)` is solved against the OLD domain
    // and applied against the NEW domain, drifting the chart to the
    // wrong data range.  See docs/plans/zoom-with-data-change-plan.md.
    if (o.projector?.raw?.xScale || o.projector?.raw?.yScale) {
      // Coalesce rapid successive calls: only the LAST domain wins.
      _pendingZoomDomain = { x, y, padding, duration, ease };
      if (!_pendingZoomFlush) {
        _pendingZoomFlush = Promise.resolve().then(_applyPendingZoom);
      }
      return;
    }

    // --- Geo mode (D3 geo projection, no cartesian projector) ---
    if (projection) {
      // x = [lon0, lon1], y = [lat0, lat1]; build the screen-space bounding
      // box from the four corners and let zoomToRect handle the rest.
      const lon0 = x?.[0] ?? -180;
      const lon1 = x?.[1] ??  180;
      const lat0 = y?.[0] ??  -90;
      const lat1 = y?.[1] ??   90;
      const corners = [
        projection([lon0, lat0]),
        projection([lon0, lat1]),
        projection([lon1, lat0]),
        projection([lon1, lat1]),
      ].filter(Boolean);
      if (corners.length < 2) return;
      const pxMin = Math.min(...corners.map(c => c[0]));
      const pxMax = Math.max(...corners.map(c => c[0]));
      const pyMin = Math.min(...corners.map(c => c[1]));
      const pyMax = Math.max(...corners.map(c => c[1]));
      zoomToRect([[pxMin, pyMin], [pxMax, pyMax]], duration, ease);
    }
  }

  // --- RESIZE ---
  function setSize() {
    if (!containerEl) return;
    _width  = containerEl.clientWidth;
    _height = o.forceSquare ? containerEl.clientWidth : containerEl.clientHeight;
    o.onResize?.(_width, _height);
  }

  function resize() {
    const pw = _width, ph = _height;
    setSize();
    if ((pw !== _width || ph !== _height) && svgEl) {
      applyClampPan();
      draw(0);
    }
  }

  // --- PROJECTOR PROP-CHANGE HANDLERS ---
  function setDuration(d) {
    o.duration = d;
  }

  function setProjector(p) {
    const old = o.projector;
    o.projector = p;
    if (!svgEl || !initialized) return;
    // A zoomToDomain queued in the same tick will fire its own draw
    // after Vue's flush — skip drawing here so we don't get a
    // (now stale) intermediate draw between the projector swap and
    // the final transformed draw.  This is what makes "data change +
    // programmatic zoom in the same click" produce ONE coherent
    // animation instead of two competing ones.  See
    // docs/plans/zoom-with-data-change-plan.md.
    if (_pendingZoomDomain) {
      if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
        // eslint-disable-next-line no-console
        console.log("[baseCanvas] setProjector — skipped draw (zoom pending)");
      }
      return;
    }
    // Resize-only projector changes (same data domain, just a new pixel range
    // because the canvas got bigger / smaller) must NOT animate — otherwise
    // every browser resize triggers a full duration tween, which looks
    // jittery and lags the page repaint.  Data / scaleType changes (where the
    // domain actually changes) continue to animate at the configured duration.
    const resizeOnly = isResizeOnlyProjectorChange(old, p);
    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[baseCanvas] setProjector", {
        resizeOnly,
        oldXDomain: old?.raw?.xScale?.domain?.(),
        newXDomain: p?.raw?.xScale?.domain?.(),
        duration: resizeOnly ? 0 : o.duration,
      });
    }
    draw(resizeOnly ? 0 : undefined);
  }

  function isResizeOnlyProjectorChange(oldP, newP) {
    if (!oldP?.raw || !newP?.raw) return false;
    const oxs = oldP.raw.xScale, nxs = newP.raw.xScale;
    const oys = oldP.raw.yScale, nys = newP.raw.yScale;
    if (!oxs || !nxs || !oys || !nys) return false;
    const rangeChanged =
      !scaleArrayEq(oxs.range?.(), nxs.range?.()) ||
      !scaleArrayEq(oys.range?.(), nys.range?.());
    const domainSame =
      scaleArrayEq(oxs.domain?.(), nxs.domain?.()) &&
      scaleArrayEq(oys.domain?.(), nys.domain?.());
    return rangeChanged && domainSame;
  }

  // Compares two scale tuples (range or domain).  Handles Date entries that
  // appear in time scales — strict === would always fail for Dates created at
  // different times even when they represent the same instant.
  function scaleArrayEq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const va = a[i] instanceof Date ? +a[i] : a[i];
      const vb = b[i] instanceof Date ? +b[i] : b[i];
      if (va !== vb) return false;
    }
    return true;
  }

  function setEase(e) {
    o.ease = e;
  }

  function setZoomAxes(axes) {
    o.zoomAxes = axes;
  }

  function setUserZoomAxes(axes) {
    o.userZoomAxes = axes;
  }

  function setMargin(m) {
    // Skip if shallow-equal — inline object literals in parent templates
    // produce a fresh reference on every render and would otherwise trigger
    // a 0-duration draw that clobbers in-flight transitions.
    const a = o.margin ?? {};
    const b = m       ?? {};
    if (a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left) {
      o.margin = m;
      return;
    }
    o.margin = m;
    if (svgEl && initialized) draw(0);
  }

  function setPadding(p) {
    // Mirror setMargin's shallow-equal guard. Padding is passthrough data on
    // the payload (innerDims ignores it), but a change still needs a redraw so
    // layers that self-position from payload.padding re-render.
    const a = o.padding ?? {};
    const b = p         ?? {};
    if (a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left) {
      o.padding = p;
      return;
    }
    o.padding = p;
    if (svgEl && initialized) draw(0);
  }

  // --- PROP-CHANGE HANDLERS (called from framework watchers) ---
  function setProjectionType(type) {
    o.projectionType = type;
    if (!svg || !storedBounds?.features?.length) return;
    const oldProjection = projection;
    projection = createProjection();
    path = d3.geoPath().projection(projection);
    fitProjection(storedBounds);
    setupZoom(d3.zoomIdentity);
    fireDraw(o.duration, { animated: true, oldProjection });
  }

  function setZoomScale(newVal, oldVal) {
    if (canRotate()) {
      const s0 = projection.scale();
      const s1 = s0 * (newVal > oldVal ? 2 : 0.5);
      const si = d3.interpolate(s0, s1);
      svg.transition().duration(o.duration).tween("zoom-scale-prop", () => (tt) => {
        projection.scale(si(tt)); redrawPaths();
      });
      return;
    }
    if (!zoomBehavior) return;
    const k = d3.zoomTransform(svg.node()).k;
    zoomToScale(newVal > oldVal ? k * 2 : k / 2);
  }

  function setRotateMode(rotateMode) {
    o.rotateMode = rotateMode;
    if (!projection) return;
    if (canRotate()) {
      if (zoomBehavior) svg.call(zoomBehavior.transform, d3.zoomIdentity);
      svg.on(".zoom", null);
      setupRotateDrag();
      draw(0);
    } else {
      svg.on(".drag", null).on("wheel.rotatezoom", null);
      setupZoom(d3.zoomIdentity);
      draw(0);
    }
  }

  function setAllowManualZoom(val) {
    o.allowManualZoom = val;
    if (canRotate()) {
      svg.on(".drag", null).on("wheel.rotatezoom", null);
      if (val) setupRotateDrag();
      return;
    }
    if (!zoomBehavior) return;
    val ? svg.call(zoomBehavior) : svg.on(".zoom", null);
  }

  // --- LIFECYCLE ---
  function init() {
    initialized = true;
    setSize();
    if (o.skipProjection || storedBounds?.features?.length) draw();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(containerEl);
    } else {
      window.addEventListener("resize", resize);
    }
  }

  function destroy() {
    if (window.ResizeObserver) resizeObserver?.unobserve(containerEl);
    else window.removeEventListener("resize", resize);
    svg.on(".zoom", null).on(".drag", null).on("wheel.rotatezoom", null);
    if (_prevAdvanceTimer) { clearTimeout(_prevAdvanceTimer); _prevAdvanceTimer = null; }
    resizeObserver = null;
  }

  return {
    init,
    fitBounds,
    draw,
    setProjector,
    setEase,
    setZoomAxes,
    setUserZoomAxes,
    setDuration,
    setMargin,
    setPadding,
    setProjectionType,
    setZoomScale,
    setRotateMode,
    setAllowManualZoom,
    setClampPanInset,
    setClampPan,
    resetZoom,
    zoomIn,
    zoomOut,
    zoomToRect,
    zoomToScale,
    setTransform,
    zoomToDomain,
    animateRotation,
    canRotate,
    get width()              { return _width; },
    get height()             { return _height; },
    get projection()         { return projection; },
    get initialRotateScale() { return initialRotateState?.scale; },
    destroy,
  };
}
