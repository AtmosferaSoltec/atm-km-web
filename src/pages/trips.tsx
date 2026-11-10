import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";

import { PageTitle } from "../components/app-shell";
import { ErrorState, PageLoader, Spinner } from "../components/states";
import { Receipt, StatusBadge, TripRow, tripReceipt } from "../components/trip-bits";
import { TripLegsView } from "../components/trip-legs-view";
import { Button, ButtonLink, Card, Chips, Sheet } from "../components/ui";
import { ApiError } from "../lib/api/client";
import { errorMessage } from "../lib/api/errors";
import { useDeleteTrip, useTrip, useTripAction, useTripList } from "../lib/api/queries";
import { formatLong, formatShort, weekLabel } from "../lib/dates";
import { money, plural } from "../lib/format";
import { groupByWeek } from "../lib/insights";
import { ROUTES } from "../lib/routes";
import { useNotify } from "../lib/toast";
import type { Trip, TripStatus } from "../lib/types";

type Filter = "all" | "pending" | "paid" | "cancelled";

const FILTERS: { value: Filter; label: string; status?: TripStatus }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Por cobrar", status: "PENDING" },
  { value: "paid", label: "Pagados", status: "PAID" },
  { value: "cancelled", label: "Cancelados", status: "CANCELLED" },
];

/**
 * One history with filters instead of "load older weeks" links. Weeks are kept
 * as the grouping because that is how the borrower gets charged.
 */
export function TripsPage() {
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.value === params.get("status")) ?? FILTERS[0];
  const list = useTripList(filter.status ?? null);

  const trips = list.data?.pages.flatMap((page) => page.trips) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const weeks = groupByWeek(trips);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Viajes" subtitle={list.data ? plural(total, "viaje", "viajes") : "\u00a0"} />

      <Chips
        value={filter.value}
        onChange={(value) => setParams(value === "all" ? {} : { status: value }, { replace: true })}
        options={FILTERS}
      />

      {list.error && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.isPending && <PageLoader />}
      {list.data && weeks.length === 0 && (
        <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No hay viajes con este filtro.</Card>
      )}

      {weeks.map((week) => (
        <section key={week.start} className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3 px-1">
            <h2 className="text-sm font-bold">{weekLabel(week.start)}</h2>
            <p className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              {week.pending > 0 && (
                <span className="font-semibold text-amber-600 dark:text-amber-400">{money(week.pending)} por cobrar</span>
              )}
              {week.pending > 0 && week.paid > 0 && " · "}
              {week.paid > 0 && `${money(week.paid)} pagado`}
            </p>
          </div>
          <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {week.trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </Card>
        </section>
      ))}

      {list.hasNextPage && (
        <Button variant="secondary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? <Spinner /> : "Ver viajes anteriores"}
        </Button>
      )}
    </div>
  );
}

export function TripDetailPage() {
  const { id = "" } = useParams();
  const query = useTrip(id);
  if (query.error instanceof ApiError && query.error.status === 404) return <Navigate to={ROUTES.trips} replace />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <PageLoader />;
  return <TripDetail trip={query.data} />;
}

function TripDetail({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const pay = useTripAction("pay");
  const unpay = useTripAction("unpay");
  const cancel = useTripAction("cancel");
  const remove = useDeleteTrip();
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const busy = pay.isPending || unpay.isPending || cancel.isPending || remove.isPending;

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      notify(done);
      return true;
    } catch (error) {
      notify(errorMessage(error));
      return false;
    }
  }

  const closed = trip.endKm != null && trip.totalAmount != null;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Viaje"
        subtitle={formatLong(trip.startDate)}
        back={ROUTES.trips}
        action={<StatusBadge status={trip.status} />}
      />

      <TripLegsView trip={trip} editable />

      {closed && (
        <Receipt
          title={trip.status === "PAID" ? `Pagado el ${formatShort(trip.paidDate ?? trip.returnDate!)}` : "Total a cobrar"}
          data={tripReceipt(trip)}
        />
      )}

      <div className="flex flex-col gap-2">
        {trip.status === "IN_PROGRESS" && (
          <>
            <ButtonLink to={ROUTES.returnTrip(trip.id)} variant="brand" size="lg">
              Recibir auto
            </ButtonLink>
            <Button variant="danger" onClick={() => setConfirm("cancel")}>
              Cancelar préstamo
            </Button>
          </>
        )}
        {trip.status === "PENDING" && (
          <Button size="lg" disabled={busy} onClick={() => run(() => pay.mutateAsync(trip.id), "Marcado como pagado")}>
            {pay.isPending ? <Spinner /> : `Marcar como pagado · ${money(trip.totalAmount ?? 0)}`}
          </Button>
        )}
        {trip.status === "PENDING" && (
          <ButtonLink to={ROUTES.returnTrip(trip.id)} variant="secondary">
            <Pencil /> Corregir devolución
          </ButtonLink>
        )}
        {trip.status === "PAID" && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => unpay.mutateAsync(trip.id), "Vuelve a estar por cobrar")}
          >
            <RotateCcw /> Deshacer pago
          </Button>
        )}
        {trip.status === "CANCELLED" && (
          <Button variant="danger" onClick={() => setConfirm("delete")}>
            <Trash2 /> Eliminar del historial
          </Button>
        )}
      </div>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "¿Eliminar este viaje?" : "¿Cancelar el préstamo?"}
      >
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
          {confirm === "delete"
            ? "Desaparece del historial. No se puede deshacer."
            : "El viaje queda como cancelado, sin monto, y el auto vuelve a estar en casa."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setConfirm(null)}>
            Volver
          </Button>
          <Button
            size="lg"
            disabled={busy}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white"
            onClick={async () => {
              if (confirm === "delete") {
                if (await run(() => remove.mutateAsync(trip.id), "Viaje eliminado")) {
                  navigate(ROUTES.trips, { replace: true });
                }
              } else if (await run(() => cancel.mutateAsync(trip.id), "Préstamo cancelado")) {
                setConfirm(null);
              }
            }}
          >
            {busy ? <Spinner /> : confirm === "delete" ? "Eliminar" : "Cancelar"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
