import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {kavachQueries, kavachQueryKeys, unwrapData} from "@/kavach/api/queries";
import type {KavachApiFilters} from "@/kavach/api/types";

const aggregateQueryOptions = {
  staleTime: 30_000,
  retry: 1,
  refetchOnWindowFocus: false,
};

export function useKavachOverview(filters: KavachApiFilters = {}) {
  return useQuery({
    queryKey: kavachQueryKeys.overview(filters),
    queryFn: ({signal}) => kavachQueries.overview(filters, signal).then((response) => unwrapData(response.data)),
    ...aggregateQueryOptions,
  });
}

export function usePoliceStations(filters: KavachApiFilters = {}) {
  return useQuery({
    queryKey: kavachQueryKeys.stations(filters),
    queryFn: ({signal}) => kavachQueries.stations(filters, signal).then((response) => unwrapData(response.data)),
    ...aggregateQueryOptions,
  });
}

export function useDataQualitySummary(filters: KavachApiFilters = {}) {
  return useQuery({
    queryKey: kavachQueryKeys.dataQuality(filters),
    queryFn: ({signal}) => kavachQueries.dataQualitySummary(filters, signal).then((response) => unwrapData(response.data)),
    ...aggregateQueryOptions,
  });
}

export function useImportCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) => kavachQueries.commitImport(importId),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ["kavach"]}),
  });
}
