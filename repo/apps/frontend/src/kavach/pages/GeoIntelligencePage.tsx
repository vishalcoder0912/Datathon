import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, MapPin, Radar, ShieldCheck, Play, Pause, FastForward, RotateCcw, Radio, Activity, Sliders } from "lucide-react";
import { kavachApi } from "@/kavach/api/kavachApi";
import { kavachQueryKeys, unwrapData } from "@/kavach/api/queries";
import { usePoliceStations } from "@/kavach/hooks/useKavachQueries";
import { useKavachFilters } from "@/kavach/context/FilterContext";
import { useImportData } from "@/kavach/context/ImportDataContext";
import MapLibreDistrictMap from "@/kavach/maps/MapLibreDistrictMap";
import GlobalFilters from "@/kavach/components/GlobalFilters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface DistrictSummary {
  district: string;
  districtId?: number;
  totalIncidents: number;
  riskScore?: number;
  activeAlerts?: number;
  hotspots?: number;
  growth?: number;
  categoryDistribution?: Array<{ name: string; value: number }>;
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
  const value = unwrapData<unknown>(payload) as { data?: DistrictSummary[] } | DistrictSummary[];
  return Array.isArray(value) ? value : value.data ?? [];
}

export default function GeoIntelligencePage() {
  const { filters, setDistricts, setPoliceStations } = useKavachFilters();
  const { refreshKey } = useImportData();
  const queryClient = useQueryClient();
  
  // Selection states
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(filters.districts[0] ?? null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  
  // Layers state
  const [showStations, setShowStations] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [showBeats, setShowBeats] = useState(false);
  const [showANPR, setShowANPR] = useState(false);

  // Timeline playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineYear, setTimelineYear] = useState(2024);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 5>(1);

  // Dispatch alerts ticker state
  const [dispatchLogs, setDispatchLogs] = useState<string[]>([
    "ANPR Alert: KA-03-MM-7821 flagged near Hosur Border Toll checkpost",
    "Beat Patrol 4: Dispatched to Sector 2 Burglary warning cluster",
    "KSP Dispatch: Emergency response units redirected to Bengaluru South Station",
  ]);

  const apiFilters = useMemo(() => filtersForApi(filters), [filters]);

  // Auto-refresh when custom data is imported
  useEffect(() => {
    if (refreshKey > 0) {
      queryClient.invalidateQueries({ queryKey: ["kavach"] });
    }
  }, [refreshKey, queryClient]);

  // Ticker updater simulation
  useEffect(() => {
    const handle = setInterval(() => {
      const mockIncidents = [
        "ANPR Alert: Suspect vehicle KA-51-N-1289 recorded passing Bellandur ANPR node",
        "KSP Dispatch: Beat Patrol unit 12 reported on-scene at Koramangala block",
        "Alert: Geospatial cluster density exceeded limit (92%) in Hubli North Sector",
        "ANPR Alert: KA-04-E-9021 flagged suspect vehicle in Mysuru region"
      ];
      const randomMsg = mockIncidents[Math.floor(Math.random() * mockIncidents.length)];
      setDispatchLogs(prev => [randomMsg, ...prev.slice(0, 4)]);
    }, 4500);
    return () => clearInterval(handle);
  }, []);

  // Timeline playback simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setTimelineYear(prev => {
          if (prev >= 2026) return 2020;
          return prev + 1;
        });
      }, 2000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed]);

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
  const stationsPayload = stationsQuery.data as any;
  const stations = useMemo(() => (Array.isArray(stationsPayload) ? stationsPayload : stationsPayload?.data ?? []), [stationsPayload]);
  const selectedStation = stations.find((station: any) => String(station.stationId) === selectedStationId) ?? null;
  const selectedDistrictSummary = districtDetailQuery.data ?? districts.find((district) => district.district === selectedDistrict) ?? null;

  const selectDistrict = useCallback((district: string) => {
    setSelectedDistrict(district);
    setSelectedStationId(null);
    setDistricts([district]);
  }, [setDistricts]);

  const selectStation = useCallback((stationId: string) => {
    setSelectedStationId(stationId);
    const station = stations.find((item: any) => String(item.stationId) === stationId);
    if (station?.districtName) setDistricts([station.districtName]);
    if (station?.stationName) setPoliceStations([station.stationName]);
  }, [setDistricts, setPoliceStations, stations]);

  const error = districtsQuery.error ?? stationsQuery.error ?? districtDetailQuery.error;
  const hotspots = Array.isArray(hotspotsQuery.data) ? hotspotsQuery.data as HotspotSummary[] : [];
  const visibleHotspots = selectedDistrict ? hotspots.filter((hotspot) => !hotspot.district || hotspot.district === selectedDistrict) : hotspots;
  const hotspotCount = visibleHotspots.length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#0891B2]">
              <Radar className="size-4 text-white" />
            </div>
            State-wide Digital Twin
          </h1>
          <p className="text-sm text-slate-500">PostGIS-backed spatial intelligence mapping beats, stations, and ANPR nodes.</p>
        </div>
      </div>
      <GlobalFilters />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-[#DC2626]">
            <AlertTriangle className="size-5" />
            Unable to load spatial intelligence.
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Left Map + Playback, Right Sidebars */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Map Column */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPin className="size-4 text-[#1D4ED8]" /> Karnataka Operations Map
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant={showStations ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => setShowStations(v => !v)}>Stations</Button>
                <Button variant={showRisk ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => setShowRisk(v => !v)}>Risk Shade</Button>
                <Button variant={showBeats ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => setShowBeats(v => !v)}>Patrol Beats</Button>
                <Button variant={showANPR ? "default" : "outline"} size="sm" className="h-7 text-[10px]" onClick={() => setShowANPR(v => !v)}>ANPR Cameras</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              {districtsQuery.isLoading ? (
                <Skeleton className="h-[480px] w-full" />
              ) : (
                <MapLibreDistrictMap
                  districts={districts}
                  stations={stations}
                  selectedDistrict={selectedDistrict}
                  showStations={showStations}
                  showRisk={showRisk}
                  onDistrictSelect={selectDistrict}
                  onStationSelect={selectStation}
                />
              )}
            </CardContent>
          </Card>

          {/* Temporal Timeline Investigation Playback Slider */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Activity className="size-3.5 text-blue-600" /> Temporal Timeline Investigation Playback
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">Active Year: {timelineYear}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`h-8 text-xs font-semibold ${isPlaying ? 'bg-[#DC2626] text-white' : 'bg-[#15803D] text-white'}`}
                >
                  {isPlaying ? <Pause className="size-3 mr-1" /> : <Play className="size-3 mr-1" />}
                  {isPlaying ? 'Pause' : 'Play timeline'}
                </Button>
                <input
                  type="range"
                  min="2020"
                  max="2026"
                  value={timelineYear}
                  onChange={(e) => setTimelineYear(Number(e.target.value))}
                  className="flex-1 accent-[#1D4ED8] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value) as any)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                >
                  <option value={1}>1x Speed</option>
                  <option value={2}>2x Speed</option>
                  <option value={5}>5x Speed</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebars */}
        <div className="space-y-4">
          {/* Active dispatch ticker */}
          <Card className="border-slate-200 bg-[#0F172A] text-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-white/10 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                <Radio className="size-4 text-rose-500 animate-pulse" /> Live Active Dispatch Ticker
              </CardTitle>
              <Badge className="bg-rose-500/10 text-rose-400 text-[9px] border-rose-500/20">OPERATIONAL</Badge>
            </CardHeader>
            <CardContent className="p-3 font-mono text-[10px] leading-5 space-y-2 h-44 overflow-y-auto">
              {dispatchLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-slate-500 shrink-0">➔</span>
                  <span className="text-slate-300">{log}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected Intelligence Details */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">District Detail Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {districtDetailQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : selectedDistrictSummary ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Selected Region</p>
                    <h2 className="text-lg font-bold text-[#0F172A]">{selectedDistrictSummary.district}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[10px] text-slate-400">Total Cases</p>
                      <p className="text-lg font-bold text-[#0F172A]">{selectedDistrictSummary.totalIncidents.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[10px] text-slate-400">Risk Metric</p>
                      <p className="text-lg font-bold text-[#0F172A]">{Math.round(selectedDistrictSummary.riskScore ?? 0)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[10px] text-slate-400">Hotspots</p>
                      <p className="text-lg font-bold text-[#0F172A]">{selectedDistrictSummary.hotspots ?? hotspotCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[10px] text-slate-400">Active Warnings</p>
                      <p className="text-lg font-bold text-[#0F172A]">{selectedDistrictSummary.activeAlerts ?? 3}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 text-xs text-blue-900 leading-4">
                    <ShieldCheck className="inline size-3.5 text-blue-600 mr-1 shrink-0 mt-0.5" />
                    Statewide decision support weights verified for current operations.
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  Select a district on the map or list to load parameters.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accessible District List */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-semibold text-slate-700">Accessible District Index</CardTitle>
          <Badge variant="secondary">{districts.length} regions</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {districts.slice(0, 12).map((district) => (
              <button
                key={district.district}
                type="button"
                onClick={() => selectDistrict(district.district)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                  selectedDistrict === district.district
                    ? "border-[#1D4ED8] bg-blue-50/60 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="block font-semibold text-[#0F172A]">{district.district}</span>
                  <span className="text-[10px] text-slate-400">{district.totalIncidents.toLocaleString()} cases</span>
                </span>
                <span className="text-right text-[10px] text-slate-500">
                  Risk
                  <br />
                  <strong className="text-[#0F172A] text-sm">{Math.round(district.riskScore ?? 0)}</strong>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
