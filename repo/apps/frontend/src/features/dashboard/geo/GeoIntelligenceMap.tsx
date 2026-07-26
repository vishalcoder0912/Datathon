import { useState, memo, useCallback, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import worldGeographies from "@/assets/maps/countries-110m.json";
import type { GeoLocationData } from "./geoIntelligenceEngine";

interface TooltipData {
  location: GeoLocationData;
  x: number;
  y: number;
}

interface GeoIntelligenceMapProps {
  locations: GeoLocationData[];
  onCountryClick: (country: string) => void;
  activityLabel: string;
}

function getColorIntensity(value: number, min: number, max: number): number {
  if (max === min) return 0.4;
  return 0.15 + ((value - min) / (max - min)) * 0.75;
}

interface GeoFeature {
  properties: {
    name?: string;
    ADMIN?: string;
  };
  rsmKey: string;
}

const GeoIntelligenceMap = memo(function GeoIntelligenceMap({
  locations,
  onCountryClick,
  activityLabel,
}: GeoIntelligenceMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const locationMap = useMemo(() => {
    const map = new Map<string, GeoLocationData>();
    for (const loc of locations) {
      map.set(loc.name.toLowerCase(), loc);
    }
    return map;
  }, [locations]);

  const metricValues = useMemo(
    () => locations.map((l) => l.metricValue),
    [locations],
  );
  const minMetric = Math.min(...metricValues);
  const maxMetric = Math.max(...metricValues);

  const handleMouseEnter = useCallback(
    (geo: GeoFeature, event: React.MouseEvent) => {
      const name: string = geo.properties?.name || geo.properties?.ADMIN || "";
      if (!name) return;
      const loc = locationMap.get(name.toLowerCase());
      if (!loc) return;
      setTooltip({ location: loc, x: event.clientX, y: event.clientY });
    },
    [locationMap],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (tooltip) {
        setTooltip({ ...tooltip, x: event.clientX, y: event.clientY });
      }
    },
    [tooltip],
  );

  const handleClick = useCallback(
    (geo: GeoFeature) => {
      const name: string = geo.properties?.name || geo.properties?.ADMIN || "";
      if (!name) return;
      const loc = locationMap.get(name.toLowerCase());
      if (loc) onCountryClick(loc.name);
    },
    [locationMap, onCountryClick],
  );

  return (
    <div className="relative w-full" onMouseMove={handleMouseMove}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [0, 30] }}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup zoom={1} center={[0, 30]} minZoom={1} maxZoom={4}>
          <Geographies geography={worldGeographies}>
            {({ geographies }) =>
              geographies.map((geo: GeoFeature) => {
                const name: string =
                  geo.properties?.name || geo.properties?.ADMIN || "";
                const loc = locationMap.get(name.toLowerCase());
                const hasData = Boolean(loc);
                const intensity = loc
                  ? getColorIntensity(loc.metricValue, minMetric, maxMetric)
                  : 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={(event: React.MouseEvent) =>
                      handleMouseEnter(geo, event)
                    }
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: {
                        fill: hasData
                          ? `rgba(139, 92, 246, ${intensity})`
                          : "rgba(51, 65, 85, 0.4)",
                        stroke: hasData
                          ? "rgba(139, 92, 246, 0.6)"
                          : "rgba(71, 85, 105, 0.3)",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: hasData
                          ? `rgba(168, 85, 247, ${Math.min(intensity + 0.2, 1)})`
                          : "rgba(71, 85, 105, 0.6)",
                        stroke: hasData ? "#a855f7" : "rgba(148, 163, 184, 0.5)",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: hasData ? "pointer" : "default",
                      },
                      pressed: {
                        fill: hasData
                          ? "rgba(126, 34, 206, 0.9)"
                          : "rgba(51, 65, 85, 0.4)",
                        stroke: hasData ? "#7c3aed" : "rgba(71, 85, 105, 0.3)",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 min-w-[220px] rounded-xl border border-violet-500/40 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur-md"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="mb-2 flex items-center gap-2 border-b border-slate-700/60 pb-2">
            <span className="size-2 rounded-full bg-violet-400" />
            <span className="font-semibold text-white">
              {tooltip.location.name}
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            <p>
              <span className="text-slate-500">Activity:</span> {activityLabel}
            </p>
            <p>
              <span className="text-slate-500">
                {tooltip.location.kpiLabel}:
              </span>{" "}
              <span className="font-medium text-violet-300">
                {tooltip.location.kpiFormatted}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Records:</span>{" "}
              {tooltip.location.recordCount.toLocaleString()}
            </p>
            <p>
              <span className="text-slate-500">Rank:</span> #
              {tooltip.location.rank}
            </p>
            <p className="border-t border-slate-700/40 pt-1 text-xs italic text-slate-400">
              {tooltip.location.insight}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

export default GeoIntelligenceMap;
