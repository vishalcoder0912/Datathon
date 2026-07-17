import {useCallback, useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AlertTriangle, Info, MapPin, Radar, ShieldCheck} from "lucide-react";
import {kavachApi} from "@/kavach/api/kavachApi";
import {kavachQueryKeys, unwrapData} from "@/kavach/api/queries";
import {usePoliceStations} from "@/kavach/hooks/useKavachQueries";
import {useKavachFilters} from "@/kavach/context/FilterContext";
import MapLibreDistrictMap from "@/kavach/maps/MapLibreDistrictMap";
import GlobalFilters from "@/kavach/components/GlobalFilters";
import {Card, CardContent, CardHeader, CardTitle} from "@/shared/components/ui/card";
import {Badge} from "@/shared/components/ui/badge";
import {Button} from "@/shared/components/ui/button";
import {Skeleton} from "@/shared/components/ui/skeleton";

interface DistrictSummary {
  district: string;
  districtId?: number;
  totalIncidents: number;
  riskScore?: number;
  activeAlerts?: number;
  hotspots?: number;
  growth?: number;
  categoryDistribution?: Array<{name: string; value: number}>;
}

interface HotspotSummary {
  hotspotId?: string;
  id?: string;
  district?: string;
  incidentCount?: number;
  dominantCategory?: string;
  riskScore?: number;
  confidence?: number;
  evidence?: string[];
}

function filtersForApi(filters: ReturnType<typeof useKavachFilters>["filters"]) {
  return {
    ...filters,
    daypart: filters.timeOfDay || undefined,
  };
}

function toDistrictList(payload: unknown): DistrictSummary[] {
  const value = unwrapData<unknown>(payload) as {data?: DistrictSummary[]} | DistrictSummary[];
  return Array.isArray(value) ? value : value.data ?? [];
}

export default function GeoIntelligencePage() {
  const {filters, setDistricts, setPoliceStations} = useKavachFilters();
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(filters.districts[0] ?? null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [showStations, setShowStations] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const apiFilters = useMemo(() => filtersForApi(filters), [filters]);

  const districtsQuery = useQuery({
    queryKey: kavachQueryKeys.districts(apiFilters),
    queryFn: () => kavachApi.getDistricts(apiFilters).then((response) => toDistrictList(response.data)),
    staleTime: 30_000,
    retry: 1,
  });
  const stationsQuery = usePoliceStations(apiFilters);
  const districtDetailQuery = useQuery({
    queryKey: ["kavach", "district", selectedDistrict, apiFilters],
    queryFn: () => kavachApi.getDistrict(selectedDistrict ?? "", apiFilters).then((response) => unwrapData<DistrictSummary>(response.data)),
    enabled: Boolean(selectedDistrict),
    staleTime: 30_000,
    retry: 1,
  });
  const hotspotsQuery = useQuery({
    queryKey: ["kavach", "hotspots", apiFilters],
    queryFn: () => kavachApi.getHotspots(apiFilters).then((response) => unwrapData<unknown>(response.data)),
    staleTime: 30_000,
    retry: 1,
  });

  const districts = districtsQuery.data ?? [];
  const stationsPayload = stationsQuery.data as Array<{stationId: number; stationName: string; districtName?: string; totalIncidents: number; latitude?: number; longitude?: number}> | {data?: Array<{stationId: number; stationName: string; districtName?: string; totalIncidents: number; latitude?: number; longitude?: number}>} | undefined;
  const stations = useMemo(() => (Array.isArray(stationsPayload) ? stationsPayload : stationsPayload?.data ?? []), [stationsPayload]);
  const selectedStation = stations.find((station) => String(station.stationId) === selectedStationId) ?? null;
  const selectedDistrictSummary = districtDetailQuery.data ?? districts.find((district) => district.district === selectedDistrict) ?? null;

  const selectDistrict = useCallback((district: string) => {
    setSelectedDistrict(district);
    setSelectedStationId(null);
    setDistricts([district]);
  }, [setDistricts]);

  const selectStation = useCallback((stationId: string) => {
    setSelectedStationId(stationId);
    const station = stations.find((item) => String(item.stationId) === stationId);
    if (station?.districtName) setDistricts([station.districtName]);
    if (station?.stationName) setPoliceStations([station.stationName]);
  }, [setDistricts, setPoliceStations, stations]);

  const error = districtsQuery.error ?? stationsQuery.error ?? districtDetailQuery.error;
  const hotspots = Array.isArray(hotspotsQuery.data) ? hotspotsQuery.data as HotspotSummary[] : [];
  const visibleHotspots = selectedDistrict ? hotspots.filter((hotspot) => !hotspot.district || hotspot.district === selectedDistrict) : hotspots;
  const hotspotCount = visibleHotspots.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Geo Intelligence</h1>
        <p className="text-sm text-slate-500">PostGIS-backed district and police-station intelligence across Karnataka.</p>
      </div>
      <GlobalFilters />

      {error && <Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-5 text-sm text-[#DC2626]"><AlertTriangle className="size-5" />Unable to load spatial intelligence for the selected scope.</CardContent></Card>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden border-slate-200 lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MapPin className="size-4" /> District and station map</CardTitle>
            <div className="flex items-center gap-2"><Button variant={showStations ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setShowStations((value) => !value)}>Stations</Button><Button variant={showRisk ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setShowRisk((value) => !value)}>Risk layer</Button></div>
          </CardHeader>
          <CardContent className="p-0">
            {districtsQuery.isLoading ? <Skeleton className="h-[500px] w-full" /> : <MapLibreDistrictMap districts={districts} stations={stations} selectedDistrict={selectedDistrict} showStations={showStations} showRisk={showRisk} onDistrictSelect={selectDistrict} onStationSelect={selectStation} />}
          </CardContent>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-600"><span><span className="mr-1 inline-block size-2 rounded-full bg-[#7dd3fc]" />Lower incident concentration</span><span><span className="mr-1 inline-block size-2 rounded-full bg-[#ef4444]" />Higher incident concentration</span><span>Illustrative synthetic district overlays; live filters are applied server-side.</span></div>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700">Selected intelligence</CardTitle></CardHeader>
          <CardContent>
            {districtDetailQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-20 w-full" /></div> : selectedDistrictSummary ? <div className="space-y-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">District</p><h2 className="text-lg font-bold text-[#0F172A]">{selectedDistrictSummary.district}</h2></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Incidents</p><p className="text-xl font-bold text-[#0F172A]">{selectedDistrictSummary.totalIncidents.toLocaleString()}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Risk score</p><p className="text-xl font-bold text-[#0F172A]">{Math.round(selectedDistrictSummary.riskScore ?? 0)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Hotspots</p><p className="text-xl font-bold text-[#0F172A]">{selectedDistrictSummary.hotspots ?? hotspotCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active alerts</p><p className="text-xl font-bold text-[#0F172A]">{selectedDistrictSummary.activeAlerts ?? 0}</p></div></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck className="mr-1 inline size-3.5" />Risk is a geographic decision-support score. It requires human review and is not an assessment of any person.</div></div> : <div className="py-10 text-center text-sm text-slate-500">Select a district on the map or list.</div>}
            {selectedStation && <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs uppercase text-slate-500">Police station</p><p className="font-semibold text-[#0F172A]">{selectedStation.stationName}</p><p className="mt-1 text-sm text-slate-600">{selectedStation.totalIncidents.toLocaleString()} scoped incidents</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-sm font-semibold text-slate-700">Accessible district list</CardTitle><Badge variant="secondary">{districts.length} districts</Badge></CardHeader>
        <CardContent>{districtsQuery.isLoading ? <Skeleton className="h-20 w-full" /> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{districts.map((district) => <button key={district.district} type="button" onClick={() => selectDistrict(district.district)} className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${selectedDistrict === district.district ? "border-[#1D4ED8] bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><span><span className="block font-semibold text-[#0F172A]">{district.district}</span><span className="text-xs text-slate-500">{district.totalIncidents.toLocaleString()} incidents</span></span><span className="text-right text-xs text-slate-500">Risk<br /><strong className="text-[#0F172A]">{Math.round(district.riskScore ?? 0)}</strong></span></button>)}</div>}</CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Radar className="size-4" /> Hotspot evidence</CardTitle></CardHeader>
        <CardContent>{hotspotsQuery.isLoading ? <Skeleton className="h-20 w-full" /> : visibleHotspots.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleHotspots.slice(0, 6).map((hotspot, index) => <div key={hotspot.hotspotId ?? hotspot.id ?? index} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="font-medium text-[#0F172A]">{hotspot.dominantCategory ?? "Mixed category hotspot"}</p><Badge variant="secondary">{hotspot.incidentCount ?? 0} cases</Badge></div><p className="mt-1 text-xs text-slate-500">{hotspot.district ?? "Current scope"} · geographic score {Math.round(hotspot.riskScore ?? 0)} · confidence {Math.round((hotspot.confidence ?? 0) * 100)}%</p>{hotspot.evidence?.[0] && <p className="mt-2 text-xs leading-5 text-slate-600">{hotspot.evidence[0]}</p>}<p className="mt-2 text-xs text-amber-800">Human review required; a cluster is not proof of criminal activity.</p></div>)}</div> : <p className="py-4 text-sm text-slate-500">No hotspot met the configured minimum-record threshold in this scope.</p>}</CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50"><CardContent className="flex items-start gap-3 p-4 text-sm text-slate-600"><Info className="mt-0.5 size-4 shrink-0 text-[#0891B2]" /><span><strong className="text-slate-700">Explainability:</strong> District shading uses the scoped incident count. Hotspots are computed from timestamped incident coordinates with a minimum-record threshold, and all selected map entities are filtered by the active district, station, date, category, and daypart controls.</span></CardContent></Card>
    </div>
  );
}
