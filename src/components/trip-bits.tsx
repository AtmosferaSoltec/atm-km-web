import { Link } from "react-router";
import { Check, ChevronRight, Flame, Fuel } from "lucide-react";

import { FUEL_LABELS, type Billing } from "../lib/billing";
import { formatRange } from "../lib/dates";
import { cn, km, money, num } from "../lib/format";
import { ROUTES } from "../lib/routes";
import type { FuelType, Trip, TripStatus } from "../lib/types";

const STATUS: Record<TripStatus, { label: string; className: string }> = {
  IN_PROGRESS: { label: "En curso", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  PENDING: { label: "Por cobrar", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  PAID: { label: "Pagado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  CANCELLED: { label: "Cancelado", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function StatusBadge({ status }: { status: TripStatus }) {
  const { label, className } = STATUS[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", className)}>{label}</span>;
}

export function TripIcon({ trip }: { trip: Trip }) {
  const Icon = trip.fuelType === "LPG" ? Flame : Fuel;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      <Icon className="size-[18px]" />
    </span>
  );
}

export function tripSummary(trip: Trip) {
  if (trip.status === "CANCELLED" && trip.endKm == null) return "Cancelado antes de devolverse";
  if (trip.distanceKm == null || trip.fuelType == null) return `Desde ${km(trip.startKm)}`;
  return `${km(trip.distanceKm)} · ${FUEL_LABELS[trip.fuelType]}`;
}

export function TripRow({ trip }: { trip: Trip }) {
  return (
    <Link
      to={ROUTES.trip(trip.id)}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/50"
    >
      <TripIcon trip={trip} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{formatRange(trip.startDate, trip.returnDate)}</p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{tripSummary(trip)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn("text-sm font-bold tabular-nums", trip.status === "CANCELLED" && "text-zinc-400 line-through")}>
          {trip.totalAmount != null ? money(trip.totalAmount) : "—"}
        </span>
        <StatusBadge status={trip.status} />
      </div>
      <ChevronRight className="size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
    </Link>
  );
}

/** A trip row that is ticked instead of opened: used to pick which trips were paid. */
export function SelectableTripRow({ trip, selected, onToggle }: { trip: Trip; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition active:bg-zinc-100 dark:active:bg-zinc-800/50"
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-lg ring-2 transition",
          selected ? "bg-brand text-ink ring-transparent" : "bg-white ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{formatRange(trip.startDate, trip.returnDate)}</p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{tripSummary(trip)}</p>
      </div>
      <span className="text-sm font-bold tabular-nums">{trip.totalAmount != null ? money(trip.totalAmount) : "—"}</span>
    </button>
  );
}

export type ReceiptData = Billing & { distanceKm: number; fuelType: FuelType };

/** Builds the receipt of a closed trip from the rates stored on the trip itself. */
export function tripReceipt(trip: Trip): ReceiptData {
  return {
    distanceKm: trip.distanceKm ?? 0,
    fuelType: trip.fuelType ?? "GASOLINE",
    fuelRate: trip.fuelRate ?? 0,
    wearRate: trip.wearRate ?? 0,
    fuelAmount: trip.fuelAmount ?? 0,
    wearAmount: trip.wearAmount ?? 0,
    totalAmount: trip.totalAmount ?? 0,
  };
}

/** Receipt-style breakdown: the same in the form preview and in the trip detail. */
export function Receipt({ data, title = "Total a cobrar" }: { data: ReceiptData; title?: string }) {
  const rows = [
    {
      label: `Combustible · ${FUEL_LABELS[data.fuelType]}`,
      hint: `${money(data.fuelRate)} × ${num(data.distanceKm)} km`,
      value: money(data.fuelAmount),
    },
    {
      label: "Desgaste y uso",
      hint: `${money(data.wearRate)} × ${num(data.distanceKm)} km`,
      value: money(data.wearAmount),
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-5 text-white dark:ring-1 dark:ring-zinc-800">
      <div className="bg-brand absolute inset-x-0 top-0 h-1" />
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="min-w-0">
              <span className="block text-zinc-300">{row.label}</span>
              <span className="block text-xs text-zinc-500">{row.hint}</span>
            </dt>
            <dd className="font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-end justify-between border-t border-dashed border-zinc-700 pt-4">
        <span className="text-sm font-medium text-zinc-400">{title}</span>
        <span className="text-brand text-3xl font-bold tracking-tight tabular-nums">{money(data.totalAmount)}</span>
      </div>
    </div>
  );
}
