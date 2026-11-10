import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CarFront, Check, Gauge, KeyRound, Link2, Receipt } from "lucide-react";

import { ErrorState, PageLoader, Spinner } from "../components/states";
import { SelectableTripRow, TripRow } from "../components/trip-bits";
import { UsageCard } from "../components/usage-card";
import { SelectableVoucherRow, VouchersSheet } from "../components/vouchers";
import { Button, ButtonLink, Card, SectionTitle, Sheet } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import { useHome, usePayMany, useSettings, type PayInput } from "../lib/api/queries";
import { useUser } from "../lib/auth";
import { ratePerKm } from "../lib/billing";
import { daysBetween, formatLong, today } from "../lib/dates";
import { km, money, plural } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { useNotify } from "../lib/toast";
import type { Home, Pending, Settings, Trip, Voucher } from "../lib/types";

export function HomePage() {
  const user = useUser();
  const home = useHome();
  const settings = useSettings();

  if (home.error || settings.error) {
    return (
      <ErrorState
        error={home.error ?? settings.error}
        onRetry={() => {
          home.refetch();
          settings.refetch();
        }}
      />
    );
  }
  if (!home.data || !settings.data) return <PageLoader />;

  const { last30Days, recentTrips } = home.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatLong(today())}</p>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {user.displayName}</h1>
      </div>

      <CarStatus home={home.data} settings={settings.data} />

      <PendingCard pending={home.data.pending} settings={settings.data} />

      {/* Last 30 days rather than "this month": early in the month everything would read zero. */}
      <section className="flex flex-col gap-2">
        <SectionTitle>Últimos 30 días</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Km prestados" value={km(last30Days.distanceKm)} />
          <Stat label="Cobrado" value={money(last30Days.charged)} />
          <Stat label="Combustible" value={money(last30Days.fuelSpent)} to={ROUTES.fuel} />
        </div>
      </section>

      <UsageCard />

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <Link to={ROUTES.trips} className="flex items-center gap-1 py-1 text-sm font-semibold text-teal">
              Ver todo <ArrowRight className="size-4" />
            </Link>
          }
        >
          Últimos viajes
        </SectionTitle>
        {recentTrips.length === 0 ? (
          <Card className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay viajes. Cuando prestes el auto, aparecerán aquí.
          </Card>
        ) : (
          <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {recentTrips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/**
 * The car's state leads the screen: it is either home (the action is to lend
 * it) or lent out (the action is to take it back). In atm-km these were a
 * button and a blue card competing with the totals.
 */
function CarStatus({ home, settings }: { home: Home; settings: Settings }) {
  const { openTrip, lastOdometer } = home;
  const { rates } = settings;

  if (!openTrip) {
    return (
      <Card className="relative overflow-hidden p-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              En casa
            </span>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Odómetro</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{km(lastOdometer)}</p>
          </div>
          <CarFront className="size-14 text-zinc-200 dark:text-zinc-800" strokeWidth={1.4} />
        </div>
        <ButtonLink to={ROUTES.lend} variant="brand" size="lg" className="mt-5 w-full">
          <KeyRound />
          Prestar auto
        </ButtonLink>
      </Card>
    );
  }

  const daysOut = daysBetween(openTrip.startDate, today());

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-5 text-white">
      <div className="bg-brand absolute -top-24 -right-16 size-56 rounded-full opacity-25 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-lime">
          <span className="size-1.5 animate-pulse rounded-full bg-lime" />
          Prestado
        </span>
        <p className="mt-3 text-3xl font-bold tracking-tight">
          {daysOut === 0 ? "Desde hoy" : `Hace ${plural(daysOut, "día", "días")}`}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
          <Gauge className="size-4" /> Salió con {km(openTrip.startKm)}
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          {money(ratePerKm("GASOLINE", rates))}/km gasolina · {money(ratePerKm("LPG", rates))}/km GLP
        </p>
        <ButtonLink to={ROUTES.returnTrip(openTrip.id)} variant="brand" size="lg" className="mt-5 w-full">
          Recibir auto
        </ButtonLink>
      </div>
    </div>
  );
}

function PendingCard({ pending, settings }: { pending: Pending; settings: Settings }) {
  const notify = useNotify();
  const payMany = usePayMany();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [managingVouchers, setManagingVouchers] = useState(false);
  const { trips, vouchers, totalAmount, voucherAmount, balance } = pending;
  const { shareToken } = settings;

  if (trips.length === 0 && vouchers.length === 0) {
    return (
      <>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Check className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Todo cobrado</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Tu familiar no te debe nada.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setManagingVouchers(true)}>
            <Receipt /> Voucher
          </Button>
        </Card>
        <VouchersSheet
          open={managingVouchers}
          onClose={() => setManagingVouchers(false)}
          vouchers={vouchers}
        />
      </>
    );
  }

  async function copyShareLink() {
    const sharePath = ROUTES.share(shareToken);
    try {
      await navigator.clipboard.writeText(location.origin + sharePath);
      notify("Enlace copiado");
    } catch {
      navigate(sharePath);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {balance < 0 ? "A favor de tu familiar" : "Por cobrar"}
          </p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{money(Math.abs(balance))}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {plural(trips.length, "viaje", "viajes")} sin pagar · {money(totalAmount)}
            {vouchers.length > 0 && ` − ${money(voucherAmount)} en ${plural(vouchers.length, "voucher", "vouchers")}`}
          </p>
        </div>
        <Link
          to={`${ROUTES.trips}?status=pending`}
          className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        >
          Ver
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copyShareLink}>
          <Link2 /> Copiar enlace
        </Button>
        <Button variant="secondary" onClick={() => setManagingVouchers(true)}>
          <Receipt /> Vouchers{vouchers.length > 0 && ` · ${vouchers.length}`}
        </Button>
        <Button className="col-span-2" disabled={trips.length === 0} onClick={() => setConfirming(true)}>
          <Check /> Ya me pagó
        </Button>
      </div>

      <VouchersSheet
        open={managingVouchers}
        onClose={() => setManagingVouchers(false)}
        vouchers={vouchers}
      />

      {/* Mounted only while open, so every opening starts with everything ticked. */}
      {confirming && (
        <SettleSheet
          open
          onClose={() => setConfirming(false)}
          trips={trips}
          vouchers={vouchers}
          paying={payMany.isPending}
          pay={async (input) => {
            try {
              const result = await payMany.mutateAsync(input);
              setConfirming(false);
              notify(`Cobraste ${money(Number(result.summary.net_amount))}`);
            } catch (error) {
              notify(errorMessage(error));
            }
          }}
        />
      )}
    </Card>
  );
}

/**
 * Pick what the borrower just paid: the trips, and the fuel vouchers that are
 * discounted from them. Everything starts ticked (the usual case is paying it
 * all); untick what was left out and the amount to collect follows.
 */
function SettleSheet({
  open,
  onClose,
  trips,
  vouchers,
  pay,
  paying,
}: {
  open: boolean;
  onClose: () => void;
  trips: Trip[];
  vouchers: Voucher[];
  pay: (input: PayInput) => Promise<void>;
  paying: boolean;
}) {
  // Kept as the unticked ones, so a trip or voucher that shows up later is ticked by default.
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const selectedTrips = trips.filter((t) => !unticked.has(t.id));
  const selectedVouchers = vouchers.filter((v) => !unticked.has(v.id));
  const tripsTotal = selectedTrips.reduce((sum, t) => sum + (t.totalAmount ?? 0), 0);
  const vouchersTotal = selectedVouchers.reduce((sum, v) => sum + v.amount, 0);
  // Cents, so the comparison never trips on float noise.
  const net = Math.round((tripsTotal - vouchersTotal) * 100) / 100;
  const allTrips = selectedTrips.length === trips.length;

  function toggle(id: string) {
    const next = new Set(unticked);
    if (!next.delete(id)) next.add(id);
    setUnticked(next);
  }

  const blocked = selectedTrips.length === 0 ? "Elige al menos un viaje" : net < 0 ? "Los vouchers superan el total: quita alguno" : null;

  return (
    <Sheet open={open} onClose={onClose} title="¿Qué te pagó?">
      <div className="mb-3 flex items-center justify-between px-1 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">
          {selectedTrips.length} de {plural(trips.length, "viaje", "viajes")}
        </span>
        <button
          type="button"
          className="font-semibold text-teal"
          onClick={() => setUnticked(allTrips ? new Set(trips.map((t) => t.id)) : new Set())}
        >
          {allTrips ? "Ninguno" : "Todos"}
        </button>
      </div>
      <Card className="mb-4 divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
        {trips.map((trip) => (
          <SelectableTripRow key={trip.id} trip={trip} selected={!unticked.has(trip.id)} onToggle={() => toggle(trip.id)} />
        ))}
      </Card>

      {vouchers.length > 0 && (
        <>
          <p className="mb-3 px-1 text-sm text-zinc-500 dark:text-zinc-400">Vouchers de combustible que descuentas</p>
          <Card className="mb-4 divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {vouchers.map((voucher) => (
              <SelectableVoucherRow
                key={voucher.id}
                voucher={voucher}
                selected={!unticked.has(voucher.id)}
                onToggle={() => toggle(voucher.id)}
              />
            ))}
          </Card>
        </>
      )}

      <dl className="mb-4 flex flex-col gap-1 px-1 text-sm">
        {vouchersTotal > 0 && (
          <>
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <dt>Viajes</dt>
              <dd className="tabular-nums">{money(tripsTotal)}</dd>
            </div>
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <dt>Vouchers</dt>
              <dd className="tabular-nums">−{money(vouchersTotal)}</dd>
            </div>
          </>
        )}
        <div className="flex items-end justify-between">
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Total a cobrar</dt>
          <dd className="text-3xl font-bold tracking-tight tabular-nums">{money(Math.max(net, 0))}</dd>
        </div>
      </dl>
      <Button
        size="lg"
        variant="brand"
        className="w-full"
        disabled={paying || blocked !== null}
        onClick={() => void pay({ tripIds: selectedTrips.map((t) => t.id), voucherIds: selectedVouchers.map((v) => v.id) })}
      >
        {paying ? <Spinner /> : (blocked ?? `Marcar ${plural(selectedTrips.length, "viaje", "viajes")} como pagados`)}
      </Button>
    </Sheet>
  );
}

function Stat({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = (
    <>
      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 truncate text-base font-bold tabular-nums">{value}</p>
    </>
  );
  const className = "rounded-2xl bg-white p-3 ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800";
  return to ? (
    <Link to={to} className={`${className} transition hover:ring-teal`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
