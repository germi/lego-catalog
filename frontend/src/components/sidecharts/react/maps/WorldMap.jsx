import { forwardRef } from "react";
import raw from "../../assets/maps/countries-110m.json";
import codes from "../../assets/maps/country-codes.json";
import BaseMap from "./BaseMap.jsx";

const topoData = raw;

export const WorldMap = forwardRef(function WorldMap({
  featureAccessor = (d) => codes[d.id],
  removeFeatures  = ["ATA"],
  ...rest
}, ref) {
  return (
    <BaseMap
      ref={ref}
      topoData={topoData}
      topoObjectName="countries"
      featureAccessor={featureAccessor}
      removeFeatures={removeFeatures}
      {...rest}
    />
  );
});

export default WorldMap;
