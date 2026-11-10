import { useState } from "react";
import { useParams } from "react-router";
import { ChevronDown } from "lucide-react";

import { KmMark } from "../components/km-mark";
import { StatusBadge, TripIcon, tripSummary } from "../components/trip-bits";
import { LegPhoto } from "../components/trip-legs";
import { VoucherCard } from "../components/vouchers";
import { PageLoader } from "../components/states";
import { Card, Chips } from "../components/ui";
import { ApiError } from "../lib/api/client";
import { errorMessage } from "../lib/api/errors";
import { useSharePage } from "../lib/api/queries";
import { formatRange } from "../lib/dates";
import { cn, money, num, plural } from "../lib/format";
import type { Trip } from "../lib/types";

type Tab = "pending" | "vouchers" | "history";

/** What the borrower sees from the shared link, with no login. */
export function SharePage() {
  const { token = "" } = useParams();
  const page = useSharePage(token);
  const [tab, setTab] = useState<Tab>("pending");

  if (page.error) {
    const gone = page.error instanceof ApiError && page.error.status === 404;
    return (
      <p className="p-10 text-center text-sm text-zinc-500">
        {gone ? "Este enlace ya no está disponible." : errorMessage(page.error)}
      </p>
    );
  }
  if (!page.data) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageLoader />
      </div>
    );
  }

  const profile = page.data;
  const pending = profile.pending.trips;
  const vouchers = profile.pending.vouchers;
  const { balance, totalAmount, voucherAmount } = profile.pending;
  const list = tab === "pending" ? pending : profile.history;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
      <div className="flex items-center gap-2.5">
        <KmMark size={34} />
        <div>
          <p className="text-sm leading-tight font-bold">Auto de {profile.ownerName}</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-6 text-white">
        <div className="bg-brand absolute -top-20 -right-10 size-48 rounded-full opacity-25 blur-3xl" />
        <p className="text-brand relative text-5xl font-bold tracking-tight tabular-nums">{money(Math.max(balance, 0))}</p>
        <p className="relative mt-1 text-sm text-zinc-400">
          {pending.length > 0 ? `${plural(pending.length, "viaje", "viajes")} por pagar` : "Estás al día 🙌"}
          {vouchers.length > 0 && ` – ${money(voucherAmount)} en vouchers descontados`}
        </p>
      </div>

      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Por pagar" },
          ...(vouchers.length > 0 ? [{ value: "vouchers" as const, label: `Vouchers · ${vouchers.length}` }] : []),
          { value: "history", label: "Historial" },
        ]}
      />

      {tab === "vouchers" && (
        <div className="grid grid-cols-3 gap-2">
          {vouchers.map((voucher) => (
            <VoucherCard key={voucher.id} voucher={voucher} />
          ))}
        </div>
      )}

      <div className={cn("flex flex-col gap-2", tab === "vouchers" && "hidden")}>
        {list.length === 0 && <Card className="p-8 text-center text-sm text-zinc-500">No hay nada por aquí.</Card>}
        {list.map((trip) => (
          <SharedTrip key={trip.id} trip={trip} />
        ))}
      </div>

      {vouchers.length > 0 && (
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Total de los viajes</span>
            <span className="font-semibold tabular-nums">{money(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Vouchers de combustible ya descontados</span>
            <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">−{money(voucherAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-700">
            <span className="font-semibold">Te toca pagar</span>
            <span className="font-bold tabular-nums">{money(Math.max(balance, 0))}</span>
          </div>
        </Card>
      )}

      <p className="mt-auto pt-6 text-center text-xs text-zinc-400">Montos calculados con las tarifas acordadas.</p>
    </div>
  );
}

function SharedTrip({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <TripIcon trip={trip} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{formatRange(trip.startDate, trip.returnDate)}</p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{tripSummary(trip)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums">{money(trip.totalAmount ?? 0)}</span>
          <StatusBadge status={trip.status} />
        </div>
        <ChevronDown className={cn("size-4 text-zinc-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 bg-zinc-100 p-3 dark:bg-zinc-950">
          <SharedTripDetail trip={trip} />
        </div>
      )}
    </Card>
  );
}

/** The borrower only needs the math: km × rate. Photos show up only if there are any. */
function SharedTripDetail({ trip }: { trip: Trip }) {
  const rate = (trip.fuelRate ?? 0) + (trip.wearRate ?? 0);
  const photos = [
    { label: "Salida", photo: trip.photos.start },
    { label: "Devolución", photo: trip.photos.end },
  ].filter((p) => p.photo);

  return (
    <>
      {trip.distanceKm != null && trip.totalAmount != null && (
        <div className="flex items-baseline justify-between gap-3 px-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            {num(trip.distanceKm)} km × {money(rate)}
          </span>
          <span className="font-bold tabular-nums">{money(trip.totalAmount)}</span>
        </div>
      )}
      {photos.length > 0 && (
        <div className="flex gap-2">
          {photos.map(({ label, photo }) => (
            <div key={label} className="flex w-24 flex-col gap-1">
              <LegPhoto photo={photo} />
              <span className="pl-1 text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
