// API shapes → the shapes the screens use. Amounts become numbers only for
// display: the API already did the math, with decimals, and is the source of truth.

import { apiUrl } from "./client";
import type { FuelLogDto, FuelSummaryDto, HomeDto, PendingDto, PhotoDto, SettingsDto, ShareDto, TripDto, UsageDto, VoucherDto } from "./dto";
import type { FuelLog, FuelMonth, FuelSummary, Home, Pending, Photo, Settings, SharePage, Trip, Usage, Voucher } from "../types";

const amount = (value: string | null) => (value == null ? null : Number(value));

function toPhoto(photo: PhotoDto | null): Photo | null {
  return photo && { url: apiUrl(photo.url), takenAt: photo.taken_at, expiresAt: photo.expires_at };
}

export function toTrip(dto: TripDto): Trip {
  return {
    id: dto.id,
    status: dto.status,
    startDate: dto.start_date,
    returnDate: dto.return_date,
    paidDate: dto.paid_date,
    startKm: dto.start_km,
    endKm: dto.end_km,
    distanceKm: dto.distance_km,
    fuelType: dto.fuel_type,
    fuelRate: amount(dto.fuel_rate),
    wearRate: amount(dto.wear_rate),
    fuelAmount: amount(dto.fuel_amount),
    wearAmount: amount(dto.wear_amount),
    totalAmount: amount(dto.total_amount),
    photos: { start: toPhoto(dto.photos.start), end: toPhoto(dto.photos.end) },
  };
}

export function toSettings(dto: SettingsDto): Settings {
  return {
    shareToken: dto.share_token,
    rates: {
      gasolineRate: Number(dto.rates.gasoline_rate),
      lpgRate: Number(dto.rates.lpg_rate),
      wearRate: Number(dto.rates.wear_rate),
    },
  };
}

export function toVoucher(dto: VoucherDto): Voucher {
  return { id: dto.id, date: dto.date, amount: Number(dto.amount), photo: toPhoto(dto.photo) };
}

function toPending(dto: PendingDto): Pending {
  return {
    count: dto.count,
    totalAmount: Number(dto.total_amount),
    trips: dto.trips.map(toTrip),
    vouchers: dto.vouchers.map(toVoucher),
    voucherAmount: Number(dto.voucher_amount),
    balance: Number(dto.balance),
  };
}

export function toHome(dto: HomeDto): Home {
  return {
    openTrip: dto.open_trip && toTrip(dto.open_trip),
    pending: toPending(dto.pending),
    last30Days: {
      since: dto.last_30_days.since,
      distanceKm: dto.last_30_days.distance_km,
      charged: Number(dto.last_30_days.charged),
      fuelSpent: Number(dto.last_30_days.fuel_spent),
    },
    recentTrips: dto.recent_trips.map(toTrip),
    lastOdometer: dto.last_odometer,
    lastFuelType: dto.last_fuel_type,
  };
}

export function toFuelLog(dto: FuelLogDto): FuelLog {
  return {
    id: dto.id,
    date: dto.date,
    odometer: dto.odometer,
    fuelType: dto.fuel_type,
    amount: Number(dto.amount),
    isFull: dto.is_full,
    pricePerGallon: amount(dto.price_per_gallon),
    photo: toPhoto(dto.photo),
  };
}

export function toFuelSummary(dto: FuelSummaryDto): FuelSummary {
  return {
    months: dto.months.map(
      (m): FuelMonth => ({ key: m.month, spent: Number(m.spent), charged: Number(m.charged), logs: m.logs.map(toFuelLog) }),
    ),
    realCostPerKm: amount(dto.real_cost_per_km),
    hasMore: dto.has_more,
  };
}

export function toUsage(dto: UsageDto): Usage {
  return {
    weeks: dto.weeks.map((w) => ({ start: w.start, ownerKm: w.owner_km, borrowerKm: w.borrower_km })),
    ownerKm: dto.owner_km,
    borrowerKm: dto.borrower_km,
    ownerSharePct: dto.owner_share_pct,
  };
}

export function toSharePage(dto: ShareDto): SharePage {
  return {
    ownerName: dto.owner_name,
    pending: toPending(dto.pending),
    history: dto.history.map(toTrip),
  };
}
