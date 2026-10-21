import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { BarChartItem } from "./BarChartItem.jsx";
import gsap from "gsap";
import { BAR_CHART_DEFAULTS as D } from "../presets/BarChart.defaults.js";

export function BarChart({
  data           = D.data,
  max            = D.max,
  min            = D.min,
  duration       = D.duration,
  color          = D.color,
  compareColor   = D.compareColor,
  small          = D.small,
  compact        = D.compact,
  showName       = D.showName,
  showNumber     = D.showNumber,
  numberEnd      = D.numberEnd,
  numberOuter    = D.numberOuter,
  nameStart      = D.nameStart,
  nameWidth      = D.nameWidth,
  nameAlignEnd   = D.nameAlignEnd,
  bgColor        = D.bgColor,
  rounded        = D.rounded,
  itemClass      = D.itemClass,
  format         = D.format,
  highlighted    = D.highlighted,
  highlightClass = D.highlightClass,
  onHover,
  onSelect,
  renderBefore,
  renderAfter,
}) {
  const itemsRef = useRef({});
  const displayedDataRef = useRef(data);
  const [displayedData, setDisplayedData] = useState(data);
  const delayEnterRef = useRef(0);
  const isFirstDataChange = useRef(true);
  // Staged FLIP state: { positions: { [name]: offsetTop }, flipDelay, enterDelay }
  const pendingFlipRef = useRef(null);

  const computedMax = useMemo(() => {
    if (max !== null) return max;
    return Math.max(0, ...data.map((e) => Math.max(e.value, e.compare ?? e.value)));
  }, [data, max]);

  const computedMin = useMemo(() => {
    if (min !== null) return min;
    const allValues = data.flatMap((e) => [
      e.value,
      e.compare != null ? e.compare : e.value,
    ]);
    return Math.min(0, Math.min(...allValues));
  }, [data, min]);

  const maxFormattedLength = useMemo(
    () => Math.max(...data.map((item) => (item.displayValue || format(item.value)).length)),
    [data, format],
  );

  function capturePositions() {
    const positions = {};
    Object.keys(itemsRef.current).forEach((name) => {
      const el = itemsRef.current[name];
      if (el) positions[name] = el.offsetTop;
    });
    return positions;
  }

  useEffect(() => {
    if (isFirstDataChange.current) {
      isFirstDataChange.current = false;
      // Reset for StrictMode's intentional unmount+remount cycle.
      return () => { isFirstDataChange.current = true; };
    }

    const exits = displayedDataRef.current.filter(
      (e1) => !data.find((e2) => e2.name === e1.name),
    );
    delayEnterRef.current = exits.length ? 1 : 0;

    if (exits.length) {
      // Fade out exits, then after they're gone: update layout and FLIP.
      // Timing mirrors Vue's flip-list:
      //   - exits fade over `duration`
      //   - state updates at t=duration (items reflow to new positions)
      //   - FLIP starts immediately (flipDelay=0) since exit already provided the pause
      //   - new items enter after FLIP completes (enterDelay = 2×duration from mount)
      exits.forEach((e) => {
        if (itemsRef.current[e.name]) {
          gsap.to(itemsRef.current[e.name], { duration, opacity: 0 });
        }
      });
      setTimeout(() => {
        pendingFlipRef.current = { positions: capturePositions(), flipDelay: 0, enterDelay: duration * 2 };
        setDisplayedData(data);
        displayedDataRef.current = data;
      }, duration * 1000);
    } else {
      // No exits — update immediately.
      // Timing mirrors Vue's flip-list-fast:
      //   - bars animate first (t=0 → t=duration, handled by BarChartItem)
      //   - FLIP starts after bars settle (flipDelay = duration)
      //   - new items enter immediately (enterDelay = 0), fading in alongside bars
      pendingFlipRef.current = { positions: capturePositions(), flipDelay: duration, enterDelay: 0 };
      setDisplayedData(data);
      displayedDataRef.current = data;
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // FLIP: runs synchronously after React updates the DOM, before paint.
  useLayoutEffect(() => {
    if (!pendingFlipRef.current) return;
    const { positions: oldPositions, flipDelay, enterDelay } = pendingFlipRef.current;
    pendingFlipRef.current = null;

    const currentNames = new Set(displayedData.map((item) => item.name));
    const tweens = [];

    Object.keys(itemsRef.current).forEach((name) => {
      const el = itemsRef.current[name];
      if (!el || !currentNames.has(name)) return;

      if (oldPositions[name] === undefined) {
        // Entering item — fade in after FLIP settles.
        tweens.push(
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration, delay: enterDelay }),
        );
      } else {
        // Existing item — FLIP: animate from recorded old position to new position.
        const delta = oldPositions[name] - el.offsetTop;
        if (Math.abs(delta) >= 1) {
          tweens.push(
            gsap.fromTo(el, { y: delta }, { y: 0, duration, delay: flipDelay, ease: "power2.out" }),
          );
        }
      }
    });

    return () => tweens.forEach((t) => t.kill());
  }, [displayedData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ul className={`relative ${small ? "space-y-0" : "space-y-1"}`}>
      {displayedData.map((item) => (
        <li
          key={item.name}
          ref={(el) => {
            if (el) itemsRef.current[item.name] = el;
          }}
        >
          <BarChartItem
            item={item}
            color={color}
            compareColor={compareColor}
            max={computedMax}
            min={computedMin}
            numWidth={maxFormattedLength}
            delayEnter={delayEnterRef.current}
            compact={compact}
            duration={duration}
            showName={showName}
            showNumber={showNumber}
            bgColor={bgColor}
            small={small}
            numberEnd={numberEnd}
            numberOuter={numberOuter}
            nameStart={nameStart}
            nameWidth={nameWidth}
            nameAlignEnd={nameAlignEnd}
            rounded={rounded}
            itemClass={itemClass}
            format={format}
            highlighted={highlighted}
            highlightClass={highlightClass}
            onHover={onHover}
            onSelect={onSelect}
            renderBefore={renderBefore}
            renderAfter={renderAfter}
          />
        </li>
      ))}
    </ul>
  );
}
