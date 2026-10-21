import { PlusIcon, MinusIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";

export function ZoomControls({ chartRef, recenterMethod = "resetZoom", className, style }) {
  return (
    <div className={["absolute flex items-center gap-1", className].filter(Boolean).join(" ")} style={style}>
      <div className="flex overflow-hidden rounded-md border border-gray-200 shadow-sm">
        <button
          className="flex h-7 w-7 items-center justify-center bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
          onClick={() => chartRef?.current?.zoomIn?.()}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center border-l border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
          onClick={() => chartRef?.current?.zoomOut?.()}
        >
          <MinusIcon className="h-4 w-4" />
        </button>
      </div>
      <button
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
        onClick={() => chartRef?.current?.[recenterMethod]?.()}
      >
        <ArrowsPointingOutIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ZoomControls;
