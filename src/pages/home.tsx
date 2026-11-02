import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, CarFront, Check, Gauge, KeyRound, Link2 } from "lucide-react";

import { ErrorState, PageLoader, Spinner } from "../components/states";
import { TripRow } from "../components/trip-bits";
import { Button, ButtonLink, Card, SectionTitle, Sheet } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import { useHome, usePayMany, useSettings } from "../lib/api/queries";
import { useUser } from "../lib/auth";
import { ratePerKm } from "../lib/billing";
import { daysBetween, formatLong, today } from "../lib/dates";
import { km, money, plural } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { useNotify } from "../lib/toast";
import type { Home, Pending, Settings } from "../lib/types";

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
  const { rates, borrowerName } = settings;

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
          Prestado a {borrowerName}
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
  const { trips, totalAmount: total } = pending;
  const { borrowerName, shareToken } = settings;

  if (trips.length === 0) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="grid size-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <Check className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Todo cobrado</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{borrowerName} no te debe nada.</p>
        </div>
      </Card>
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
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Por cobrar a {borrowerName}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{money(total)}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{plural(trips.length, "viaje", "viajes")} sin pagar</p>
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
        <Button onClick={() => setConfirming(true)}>
          <Check /> Ya me pagó
        </Button>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="¿Te pagó todo?">
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Se marcan como pagados los {plural(trips.length, "viaje", "viajes")} pendientes, por{" "}
          <strong className="text-zinc-900 dark:text-white">{money(total)}</strong>. Si solo pagó uno, márcalo desde su
          detalle.
        </p>
        <Card className="mb-4 divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          {trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </Card>
        <Button
          size="lg"
          variant="brand"
          className="w-full"
          disabled={payMany.isPending}
          onClick={async () => {
            try {
              const result = await payMany.mutateAsync(trips.map((t) => t.id));
              setConfirming(false);
              notify(`${money(Number(result.summary.total_amount))} marcados como pagados`);
            } catch (error) {
              notify(errorMessage(error));
            }
          }}
        >
          {payMany.isPending ? <Spinner /> : "Marcar todo como pagado"}
        </Button>
      </Sheet>
    </Card>
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
