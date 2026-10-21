import { useRef, useEffect, useMemo } from "react";
import gsap from "gsap";
import { BAR_CHART_ITEM_DEFAULTS as D } from "../presets/BarChart.defaults.js";

export function BarChartItem({
  item           = { id: "1", name: "Data 1", value: 30 },
  max            = D.max,
  min            = D.min,
  color          = D.color,
  compareColor   = D.compareColor,
  compact        = D.compact,
  duration       = D.duration,
  showName       = D.showName,
  showNumber     = D.showNumber,
  bgColor        = D.bgColor,
  delayEnter     = D.delayEnter,
  small          = D.small,
  numberEnd      = D.numberEnd,
  numberOuter    = D.numberOuter,
  nameStart      = D.nameStart,
  nameWidth      = D.nameWidth,
  nameAlignEnd   = D.nameAlignEnd,
  rounded        = D.rounded,
  itemClass      = D.itemClass,
  format         = D.format,
  highlighted    = D.highlighted,
  highlightClass = D.highlightClass,
  numWidth       = D.numWidth,
  onHover,
  onSelect,
  renderBefore,
  renderAfter,
}) {
  const colorBarRef = useRef(null);
  const compareRef = useRef(null);
  const isFirstRender = useRef(true);

  const barColor = useMemo(() => {
    if (item.color) return item.color;
    if (typeof color === "function") return color(item.value);
    return color;
  }, [item.color, item.value, color]);

  const colorCompare = useMemo(() => {
    if (item.compareColor) return item.compareColor;
    if (typeof compareColor === "function") return compareColor(item.compare);
    return compareColor;
  }, [item.compareColor, item.compare, compareColor]);

  const isNegative = item.value < 0;
  const barRange = max - min;
  const zeroOffset = min < 0 ? (-min / barRange) * 100 : 0;

  const barLeft = useMemo(() => {
    if (item.value >= 0) return `${zeroOffset}%`;
    return `${((item.value - min) / barRange) * 100}%`;
  }, [item.value, min, barRange, zeroOffset]);

  const barWidth = useMemo(() => {
    const absVal = Math.abs(item.value);
    return `max(${(absVal / barRange) * 100}%, 2px)`;
  }, [item.value, barRange]);

  const compareLeft = useMemo(() => {
    if (item.compare == null) return null;
    return `${((item.compare - min) / barRange) * 100}%`;
  }, [item.compare, min, barRange]);

  const numSpanStyle = useMemo(() => {
    const len = numWidth ?? (item.displayValue || format(item.value)).length;
    return { width: `${len}ch` };
  }, [numWidth, item.displayValue, item.value, format]);

  // Enter animation — runs once on mount.
  // Cleanup kills in-flight tweens and resets the first-render guard so StrictMode's
  // intentional unmount+remount cycle doesn't double-fire the animation or corrupt
  // the isFirstRender flag used by the change animation below.
  useEffect(() => {
    if (!colorBarRef.current) return;
    const tweens = [
      gsap.fromTo(
        colorBarRef.current,
        { left: `${zeroOffset}%`, width: "0%", backgroundColor: barColor },
        { duration, delay: delayEnter, left: barLeft, width: barWidth, backgroundColor: barColor },
      ),
    ];
    if (item.compare != null && compareRef.current) {
      tweens.push(
        gsap.fromTo(
          compareRef.current,
          { left: `${zeroOffset}%`, backgroundColor: colorCompare, opacity: 0 },
          { duration, delay: delayEnter, left: compareLeft, backgroundColor: colorCompare, opacity: 1 },
        ),
      );
    }
    return () => {
      tweens.forEach((t) => t.kill());
      isFirstRender.current = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Change animation — runs when item changes, skips first render.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!colorBarRef.current) return;
    const tweens = [
      gsap.to(colorBarRef.current, {
        duration,
        left: barLeft,
        width: barWidth,
        backgroundColor: barColor,
      }),
    ];
    if (item.compare != null && compareRef.current) {
      tweens.push(
        gsap.to(compareRef.current, {
          duration,
          left: compareLeft,
          backgroundColor: colorCompare,
          opacity: 1,
        }),
      );
    } else if (compareRef.current) {
      tweens.push(gsap.to(compareRef.current, { duration, opacity: 0 }));
    }
    return () => tweens.forEach((t) => t.kill());
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayValue = item.displayValue || format(item.value);

  return (
    <div
      className={[
        "-mx-2 cursor-pointer rounded px-2 py-0.5",
        !compact && "pt-1",
        itemClass,
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect?.({ target: colorBarRef.current, data: item })}
      onMouseOver={() => onHover?.({ target: colorBarRef.current, data: item })}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* LABEL above bar */}
      {showName && !compact && (
        <div className="ot-bar-name relative mb-1 truncate text-sm">{item.name}</div>
      )}

      {/* Flex wrapper: active when nameStart or numberOuter */}
      <div className={nameStart || numberOuter ? "flex items-center gap-2" : ""}>
        {renderBefore?.(item)}

        {/* NAME: outside-start */}
        {showName && nameStart && (
          <span
            className={[
              "ot-bar-name shrink-0 truncate text-sm",
              nameAlignEnd ? "text-end" : "text-start",
            ].join(" ")}
            style={nameWidth ? { width: nameWidth } : undefined}
          >
            {item.name}
          </span>
        )}

        {/* NUMBER: outside-start */}
        {showNumber && numberOuter && !numberEnd && (
          <span className="shrink-0 text-end text-sm tabular-nums" style={numSpanStyle}>
            {displayValue}
          </span>
        )}

        {/* BAR */}
        <div
          className={[
            "relative flex min-w-0 flex-1 items-center",
            rounded && "rounded",
            small ? "min-h-6" : "min-h-8",
            item.id === highlighted && highlightClass,
          ].filter(Boolean).join(" ")}
          style={{ background: bgColor }}
        >
          {/* LABEL pinned to zero axis */}
          <div
            className={[
              "ot-bar-label absolute inset-y-0 z-10 flex items-center",
              small ? "px-1 text-xs" : "px-3 text-sm",
              isNegative && "flex-row-reverse",
            ].filter(Boolean).join(" ")}
            style={isNegative ? { right: `${100 - zeroOffset}%` } : { left: `${zeroOffset}%` }}
          >
            {showNumber && !numberEnd && !numberOuter && (
              <span
                className={[
                  "ot-bar-value inline-block font-semibold transition-all",
                  isNegative ? "ms-1.5 pe-1 text-start" : "me-1.5 ps-1 text-end",
                ].join(" ")}
                style={numSpanStyle}
              >
                {displayValue}
              </span>
            )}
            <span>&nbsp;</span>
            {showName && compact && !nameStart && (
              <span className="ot-bar-name">{item.name}</span>
            )}
          </div>

          {/* BAR COLOR */}
          <div
            ref={colorBarRef}
            className={[
              "ot-bar-color absolute inset-y-0 flex items-center",
              item.class,
              small ? "text-xs" : "text-sm",
              rounded && "rounded",
              isNegative && numberEnd && !numberOuter && "flex-row-reverse",
            ].filter(Boolean).join(" ")}
          >
            <div className="flex-grow">&nbsp;</div>
            {showNumber && numberEnd && !numberOuter ? (
              <span
                className={[
                  "ot-bar-value inline-block transition-all",
                  isNegative ? "ms-1.5 pe-0.5 text-start" : "me-1.5 ps-0.5 text-end",
                ].join(" ")}
                style={numSpanStyle}
              >
                {displayValue}
              </span>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>

          {/* COMPARE MARK */}
          {item.compare != null && (
            <div
              ref={compareRef}
              className="ot-bar-compare absolute inset-y-0 h-full w-1 -translate-x-0.5 rounded print:hidden"
              style={{ opacity: 0 }}
            />
          )}
        </div>

        {/* NUMBER: outside-end */}
        {showNumber && numberOuter && numberEnd && (
          <span className="shrink-0 text-end text-sm tabular-nums" style={numSpanStyle}>
            {displayValue}
          </span>
        )}

        {renderAfter?.(item)}
      </div>
    </div>
  );
}
