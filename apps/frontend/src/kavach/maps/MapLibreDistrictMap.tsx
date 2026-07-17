import {useEffect, useMemo, useRef} from "react";
import maplibregl, {type MapGeoJSONFeature} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {buildDistrictGeoJson, demoStationGeoJson} from "@/kavach/maps/demoGeo";
import type {StationSummary} from "@/kavach/api/types";

interface DistrictMetric {
  district?: string;
  districtName?: string;
  totalIncidents?: number;
  incidents?: number;
  riskScore?: number;
}

interface MapLibreDistrictMapProps {
  districts: DistrictMetric[];
  stations?: StationSummary[];
  selectedDistrict?: string | null;
  showStations: boolean;
  showRisk: boolean;
  onDistrictSelect: (district: string) => void;
  onStationSelect?: (stationId: string) => void;
}

const bareMapStyle = {
  version: 8,
  sources: {},
  layers: [{id: "background", type: "background", paint: {"background-color": "#eef6ff"}}],
} as const;

export default function MapLibreDistrictMap({districts, stations = [], selectedDistrict, showRisk, showStations, onDistrictSelect, onStationSelect}: MapLibreDistrictMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const districtData = useMemo(() => buildDistrictGeoJson(districts), [districts]);
  const stationData = useMemo(() => {
    const measuredStations = stations.filter((station) => Number.isFinite(station.longitude) && Number.isFinite(station.latitude));
    if (measuredStations.length === 0) return demoStationGeoJson;
    return {
      type: "FeatureCollection" as const,
      features: measuredStations.map((station) => ({
        type: "Feature" as const,
        properties: {stationId: String(station.stationId), stationName: station.stationName, district: station.districtName ?? ""},
        geometry: {type: "Point" as const, coordinates: [Number(station.longitude), Number(station.latitude)]},
      })),
    };
  }, [stations]);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;
    const map = new maplibregl.Map({
      container: mapElement.current,
      style: bareMapStyle,
      center: [76.2, 14.5],
      zoom: 5.3,
      minZoom: 4.5,
      maxZoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    mapInstance.current = map;

    map.on("load", () => {
      map.addSource("kavach-districts", {type: "geojson", data: districtData});
      map.addLayer({
        id: "kavach-district-fill",
        type: "fill",
        source: "kavach-districts",
        paint: {
          "fill-color": ["interpolate", ["linear"], ["get", "incidents"], 0, "#cbd5e1", 10, "#7dd3fc", 30, "#fbbf24", 70, "#ef4444"],
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({id: "kavach-district-line", type: "line", source: "kavach-districts", paint: {"line-color": "#334155", "line-width": 1}});
      map.addLayer({id: "kavach-selected-district", type: "line", source: "kavach-districts", filter: ["==", ["get", "district"], ""], paint: {"line-color": "#0f172a", "line-width": 3}});
      map.addSource("kavach-stations", {type: "geojson", data: stationData});
      map.addLayer({id: "kavach-stations", type: "circle", source: "kavach-stations", paint: {"circle-radius": 5, "circle-color": "#1d4ed8", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5}});

      map.on("click", "kavach-district-fill", (event) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
        const district = feature?.properties?.district;
        if (district) onDistrictSelect(district);
      });
      map.on("click", "kavach-stations", (event) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
        const stationId = feature?.properties?.stationId;
        if (stationId && onStationSelect) onStationSelect(stationId);
      });
      map.on("mouseenter", "kavach-district-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "kavach-district-fill", () => { map.getCanvas().style.cursor = ""; });
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [districtData, onDistrictSelect, onStationSelect, stationData]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("kavach-districts") as maplibregl.GeoJSONSource | undefined;
    source?.setData(districtData);
  }, [districtData]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("kavach-stations") as maplibregl.GeoJSONSource | undefined;
    source?.setData(stationData);
    if (map.getLayer("kavach-stations")) map.setLayoutProperty("kavach-stations", "visibility", showStations ? "visible" : "none");
  }, [showStations, stationData]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map?.isStyleLoaded()) return;
    if (map.getLayer("kavach-selected-district")) map.setFilter("kavach-selected-district", ["==", ["get", "district"], selectedDistrict ?? ""]);
    if (selectedDistrict) {
      const feature = districtData.features.find((item) => item.properties.district === selectedDistrict);
      const point = feature?.geometry.coordinates[0][0];
      if (point) map.flyTo({center: [point[0] + 0.1, point[1]], zoom: 7.2, essential: true});
    }
  }, [districtData.features, selectedDistrict]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map?.isStyleLoaded() || !map.getLayer("kavach-district-fill")) return;
    map.setPaintProperty("kavach-district-fill", "fill-opacity", showRisk ? 0.8 : 0.58);
  }, [showRisk]);

  return <div ref={mapElement} className="h-[500px] w-full overflow-hidden rounded-b-lg" aria-label="Interactive Karnataka district and police station intelligence map" />;
}
