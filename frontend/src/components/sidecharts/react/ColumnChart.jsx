import RibbonChart from "./RibbonChart.jsx";

export function ColumnChart({ children, ...props }) {
  return <RibbonChart {...props} showLinks={false}>{children}</RibbonChart>;
}

export default ColumnChart;
