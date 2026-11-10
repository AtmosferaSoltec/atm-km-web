// Shapes exactly as the Go API sends them (snake_case, money as strings).

import type { FuelType, TripStatus } from "../types";

export type PhotoDto = { url: string; taken_at: string; expires_at: string };

export type TripDto = {
  id: string;
  status: TripStatus;
  start_date: string;
  start_km: number;
  return_date: string | null;
  end_km: number | null;
  distance_km: number | null;
  fuel_type: FuelType | null;
  fuel_rate: string | null;
  wear_rate: string | null;
  fuel_amount: string | null;
  wear_amount: string | null;
  total_amount: string | null;
  paid_date: string | null;
  photos: { start: PhotoDto | null; end: PhotoDto | null };
  created_at: string;
};

export type SettingsDto = {
  rates: { gasoline_rate: string; lpg_rate: string; wear_rate: string };
  share_token: string;
};

export type VoucherDto = {
  id: string;
  date: string;
  amount: string;
  settled_date: string | null;
  photo: PhotoDto | null;
  created_at: string;
};

export type PendingDto = {
  count: number;
  total_amount: string;
  trips: TripDto[];
  vouchers: VoucherDto[];
  voucher_amount: string;
  balance: string;
};

export type HomeDto = {
  open_trip: TripDto | null;
  pending: PendingDto;
  last_30_days: { since: string; distance_km: number; charged: string; fuel_spent: string; trips: number };
  recent_trips: TripDto[];
  last_odometer: number;
  last_fuel_type: FuelType | null;
};

export type FuelLogDto = {
  id: string;
  date: string;
  odometer: number;
  fuel_type: FuelType;
  amount: string;
  is_full: boolean;
  price_per_gallon: string | null;
  photo: PhotoDto | null;
  created_at: string;
};

export type FuelSummaryDto = {
  months: { month: string; spent: string; charged: string; logs: FuelLogDto[] }[];
  real_cost_per_km: string | null;
  has_more: boolean;
};

export type UsageDto = {
  weeks: { start: string; owner_km: number; borrower_km: number }[];
  owner_km: number;
  borrower_km: number;
  owner_share_pct: number;
};

export type ShareDto = {
  owner_name: string;
  pending: PendingDto;
  history: TripDto[];
};
