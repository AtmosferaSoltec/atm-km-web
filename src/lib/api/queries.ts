// Every read and write the screens make, as TanStack Query hooks. Writes
// refresh what they affect, so screens never patch data by hand.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api, apiPage } from "./client";
import type { FuelLogDto, FuelSummaryDto, HomeDto, SettingsDto, ShareDto, TripDto, UsageDto, VoucherDto } from "./dto";
import { toFuelLog, toFuelSummary, toHome, toSettings, toSharePage, toTrip, toUsage, toVoucher } from "./mappers";
import type { FuelType, Leg, Rates, TripStatus } from "../types";

export const keys = {
  home: ["home"] as const,
  settings: ["settings"] as const,
  trips: ["trips"] as const,
  tripList: (status: TripStatus | null) => ["trips", "list", status] as const,
  trip: (id: string) => ["trips", "one", id] as const,
  fuel: ["fuel"] as const,
  fuelSummary: (months: number) => ["fuel", "summary", months] as const,
  usage: (weeks: number) => ["usage", weeks] as const,
  share: (token: string) => ["share", token] as const,
};

export const TRIPS_PAGE_SIZE = 30;

export function useHome() {
  return useQuery({ queryKey: keys.home, queryFn: async () => toHome(await api<HomeDto>("/home")) });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => toSettings(await api<SettingsDto>("/settings")),
    staleTime: 5 * 60_000,
  });
}

export function useTripList(status: TripStatus | null) {
  return useInfiniteQuery({
    queryKey: keys.tripList(status),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ page: String(pageParam), page_size: String(TRIPS_PAGE_SIZE) });
      if (status) query.set("status", status);
      const page = await apiPage<TripDto>(`/trips?${query}`);
      return { trips: page.data.map(toTrip), total: page.meta.total, page: page.meta.page };
    },
    getNextPageParam: (last) => (last.page * TRIPS_PAGE_SIZE < last.total ? last.page + 1 : undefined),
  });
}

export function useTrip(id: string) {
  return useQuery({ queryKey: keys.trip(id), queryFn: async () => toTrip(await api<TripDto>(`/trips/${id}`)) });
}

export function useFuelSummary(months: number) {
  return useQuery({
    queryKey: keys.fuelSummary(months),
    queryFn: async () => toFuelSummary(await api<FuelSummaryDto>(`/fuel/summary?months=${months}`)),
    placeholderData: (previous) => previous,
  });
}

export function useUsage(weeks: number) {
  return useQuery({ queryKey: keys.usage(weeks), queryFn: async () => toUsage(await api<UsageDto>(`/usage?weeks=${weeks}`)) });
}

export function useSharePage(token: string) {
  return useQuery({
    queryKey: keys.share(token),
    queryFn: async () => toSharePage(await api<ShareDto>(`/share/${token}`, { anonymous: true })),
    retry: (count, error) => count < 2 && !(error instanceof Error && "status" in error && error.status === 404),
  });
}

/** Anything about trips changed: home, lists, details and the fuel comparison. */
function tripsChanged(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: keys.home }),
    client.invalidateQueries({ queryKey: keys.trips }),
    client.invalidateQueries({ queryKey: keys.fuel }),
    client.invalidateQueries({ queryKey: ["usage"] }),
  ]);
}

export type LendInput = {
  startDate: string;
  startKm: number;
  /** Registers a trip that already came back. */
  return?: ReturnInput;
};

export type ReturnInput = { returnDate: string; endKm: number; fuelType: FuelType };

const returnBody = (r: ReturnInput) => ({ return_date: r.returnDate, end_km: r.endKm, fuel_type: r.fuelType });

export function useLend() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: LendInput) =>
      toTrip(
        await api<TripDto>("/trips", {
          method: "POST",
          body: {
            start_date: input.startDate,
            start_km: input.startKm,
            return: input.return ? returnBody(input.return) : undefined,
          },
        }),
      ),
    onSuccess: () => tripsChanged(client),
  });
}

export function useReceive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, ...input }: ReturnInput & { tripId: string }) =>
      toTrip(await api<TripDto>(`/trips/${tripId}/return`, { method: "POST", body: returnBody(input) })),
    onSuccess: () => tripsChanged(client),
  });
}

/** cancel, pay and unpay: one trip, one action. */
export function useTripAction(action: "cancel" | "pay" | "unpay") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => toTrip(await api<TripDto>(`/trips/${tripId}/${action}`, { method: "POST" })),
    onSuccess: () => tripsChanged(client),
  });
}

export type PayInput = { tripIds: string[]; voucherIds: string[] };

export type PayResult = {
  trip_ids: string[];
  voucher_ids: string[];
  summary: { count: number; total_amount: string; voucher_count: number; voucher_amount: string; net_amount: string };
};

/** "Ya me pagó": the ticked trips are paid and the ticked vouchers are discounted, together. */
export function usePayMany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ tripIds, voucherIds }: PayInput) =>
      api<PayResult>("/trips/pay", { method: "POST", body: { trip_ids: tripIds, voucher_ids: voucherIds } }),
    onSuccess: () => tripsChanged(client),
  });
}

export type VoucherInput = { date: string; amount: number; photo: Blob | null };

/** Registers a voucher and, if there is one, uploads its photo. The voucher exists even if the photo fails. */
export function useAddVoucher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, amount, photo }: VoucherInput) => {
      const voucher = toVoucher(
        await api<VoucherDto>("/vouchers", { method: "POST", body: { date, amount: amount.toFixed(2) } }),
      );
      if (!photo) return { voucher, photoFailed: false };
      try {
        await api<VoucherDto>(`/vouchers/${voucher.id}/photo`, { method: "PUT", blob: photo });
        return { voucher, photoFailed: false };
      } catch {
        return { voucher, photoFailed: true };
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.home }),
  });
}

export function useDeleteVoucher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (voucherId: string) => api<void>(`/vouchers/${voucherId}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.home }),
  });
}

export function useDeleteTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => api<void>(`/trips/${tripId}`, { method: "DELETE" }),
    onSuccess: (_, tripId) => {
      client.removeQueries({ queryKey: keys.trip(tripId) });
      return tripsChanged(client);
    },
  });
}

/** Uploads a leg's photo; returns the trip with its new signed URL. */
export function uploadPhoto(tripId: string, leg: Leg, photo: Blob) {
  return api<TripDto>(`/trips/${tripId}/photos/${leg}`, { method: "PUT", blob: photo }).then(toTrip);
}

export function useSetPhoto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, leg, photo }: { tripId: string; leg: Leg; photo: Blob }) => uploadPhoto(tripId, leg, photo),
    onSuccess: (trip) => {
      client.setQueryData(keys.trip(trip.id), trip);
      return tripsChanged(client);
    },
  });
}

export function useDeletePhoto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, leg }: { tripId: string; leg: Leg }) =>
      toTrip(await api<TripDto>(`/trips/${tripId}/photos/${leg}`, { method: "DELETE" })),
    onSuccess: (trip) => {
      client.setQueryData(keys.trip(trip.id), trip);
      return tripsChanged(client);
    },
  });
}

export type FuelLogInput = { date: string; odometer: number; fuelType: FuelType; amount: number; isFull: boolean; pricePerGallon?: number };

const fuelLogBody = (input: FuelLogInput) => ({
  date: input.date,
  odometer: input.odometer,
  fuel_type: input.fuelType,
  amount: input.amount.toFixed(2),
  is_full: input.isFull,
  price_per_gallon: input.pricePerGallon?.toFixed(2) ?? null,
});

/** A fuel log changed: the list, the cost per km and what home says about the fuel. */
function fuelChanged(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: keys.fuel }),
    client.invalidateQueries({ queryKey: keys.home }),
    client.invalidateQueries({ queryKey: ["usage"] }),
  ]);
}

/** Registers a fill-up and, if there is one, uploads its receipt. The fill-up exists even if the photo fails. */
export function useAddFuelLog() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ photo, ...input }: FuelLogInput & { photo?: Blob | null }) => {
      const log = toFuelLog(await api<FuelLogDto>("/fuel-logs", { method: "POST", body: fuelLogBody(input) }));
      if (!photo) return { log, photoFailed: false };
      try {
        await api<FuelLogDto>(`/fuel-logs/${log.id}/photo`, { method: "PUT", blob: photo });
        return { log, photoFailed: false };
      } catch {
        return { log, photoFailed: true };
      }
    },
    onSuccess: () => fuelChanged(client),
  });
}

export function useUpdateFuelLog() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: FuelLogInput & { id: string }) =>
      toFuelLog(await api<FuelLogDto>(`/fuel-logs/${id}`, { method: "PUT", body: fuelLogBody(input) })),
    onSuccess: () => fuelChanged(client),
  });
}

export function useSetFuelPhoto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photo }: { id: string; photo: Blob }) =>
      toFuelLog(await api<FuelLogDto>(`/fuel-logs/${id}/photo`, { method: "PUT", blob: photo })),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.fuel }),
  });
}

export function useDeleteFuelPhoto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => toFuelLog(await api<FuelLogDto>(`/fuel-logs/${id}/photo`, { method: "DELETE" })),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.fuel }),
  });
}

export function useDeleteFuelLog() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/fuel-logs/${id}`, { method: "DELETE" }),
    onSuccess: () => fuelChanged(client),
  });
}

function useSettingsMutation<T>(fn: (input: T) => Promise<SettingsDto>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => toSettings(await fn(input)),
    onSuccess: (settings) => client.setQueryData(keys.settings, settings),
  });
}

export function useUpdateRates() {
  return useSettingsMutation((rates: Rates) =>
    api<SettingsDto>("/settings/rates", {
      method: "PUT",
      body: {
        gasoline_rate: String(rates.gasolineRate),
        lpg_rate: String(rates.lpgRate),
        wear_rate: String(rates.wearRate),
      },
    }),
  );
}

export function useRotateShareToken() {
  return useSettingsMutation(() => api<SettingsDto>("/settings/share-token", { method: "POST" }));
}
