import { useState } from "react";
import { Flame, Fuel, Plus, Trash2 } from "lucide-react";

import { PageTitle } from "../components/app-shell";
import { ErrorState, PageLoader, Spinner } from "../components/states";
import { Button, Card, Field, Input, OdometerInput, Segmented, Sheet } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import { useAddFuelLog, useDeleteFuelLog, useFuelSummary, useHome, useSettings } from "../lib/api/queries";
import { FUEL_LABELS } from "../lib/billing";
import { formatMonth, formatRelative, today } from "../lib/dates";
import { cn, km, money } from "../lib/format";
import { useNotify } from "../lib/toast";
import type { FuelType } from "../lib/types";

/** Months shown at first, and how many more each "ver anteriores" adds. */
const MONTHS_STEP = 6;

export function FuelPage() {
  const notify = useNotify();
  const [months, setMonths] = useState(MONTHS_STEP);
  const summary = useFuelSummary(months);
  const settings = useSettings();
  const home = useHome();
  const deleteLog = useDeleteFuelLog();
  const [adding, setAdding] = useState(false);

  const error = summary.error ?? settings.error ?? home.error;
  if (error) {
    return <ErrorState error={error} onRetry={() => void Promise.all([summary.refetch(), settings.refetch(), home.refetch()])} />;
  }
  if (!summary.data || !settings.data || !home.data) return <PageLoader />;

  const rates = settings.data.rates;
  const costPerKm = summary.data.realCostPerKm;
  const lastFuel = summary.data.months[0]?.logs[0]?.fuelType ?? "GASOLINE";

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Combustible"
        subtitle="Solo lo ves tú"
        action={
          <Button variant="brand" onClick={() => setAdding(true)}>
            <Plus /> Carga
          </Button>
        }
      />

      {costPerKm !== null && <CostInsight costPerKm={costPerKm} gasolineRate={rates.gasolineRate} lpgRate={rates.lpgRate} />}

      {summary.data.months.length === 0 && (
        <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Registra tus cargas de combustible para ver cuánto te cuesta el auto por km.
        </Card>
      )}

      {summary.data.months.map((month) => {
        const coverage = month.spent > 0 ? Math.min(month.charged / month.spent, 1) : 0;
        const difference = month.charged - month.spent;
        return (
          <section key={month.key} className="flex flex-col gap-2">
            <Card className="p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold">{formatMonth(month.key)}</h2>
                <span className="text-lg font-bold tabular-nums">{money(month.spent)}</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="bg-brand h-full rounded-full transition-all" style={{ width: `${coverage * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Los préstamos cubrieron {money(month.charged)}
                </span>
                {month.spent > 0 && (
                  <span className={cn("font-semibold", difference >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500")}>
                    {difference >= 0 ? `+${money(difference)}` : `pusiste ${money(-difference)}`}
                  </span>
                )}
              </div>
            </Card>

            {month.logs.length > 0 && (
              <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
                {month.logs.map((log) => (
                  <div key={log.id} className="group flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-2xl",
                        log.fuelType === "LPG"
                          ? "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
                          : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
                      )}
                    >
                      {log.fuelType === "LPG" ? <Flame className="size-[18px]" /> : <Fuel className="size-[18px]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {FUEL_LABELS[log.fuelType]}
                        {log.isFull && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">
                            FULL
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatRelative(log.date)} · {km(log.odometer)}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{money(log.amount)}</span>
                    <button
                      type="button"
                      aria-label="Borrar carga"
                      disabled={deleteLog.isPending}
                      onClick={async () => {
                        try {
                          await deleteLog.mutateAsync(log.id);
                          notify("Carga borrada");
                        } catch (err) {
                          notify(errorMessage(err));
                        }
                      }}
                      className="grid size-8 place-items-center rounded-full text-zinc-300 transition hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </Card>
            )}
          </section>
        );
      })}

      {summary.data.hasMore && (
        <Button variant="secondary" disabled={summary.isFetching} onClick={() => setMonths(months + MONTHS_STEP)}>
          {summary.isFetching ? <Spinner /> : "Ver meses anteriores"}
        </Button>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Registrar carga">
        <FuelForm lastFuel={lastFuel} lastOdometer={home.data.lastOdometer} onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  );
}

/**
 * New in the remake: the real cost per km comes from the fuel logs themselves
 * and is compared with the rates being charged. It answers "am I charging
 * enough?" without doing the math.
 */
function CostInsight({ costPerKm, gasolineRate, lpgRate }: { costPerKm: number; gasolineRate: number; lpgRate: number }) {
  const max = Math.max(costPerKm, gasolineRate, lpgRate) * 1.15;
  const bars = [
    { label: "Tu costo real", value: costPerKm, className: "bg-brand" },
    { label: "Cobras gasolina", value: gasolineRate, className: "bg-orange-400" },
    { label: "Cobras GLP", value: lpgRate, className: "bg-sky-400" },
  ];
  const lpgBelowCost = lpgRate < costPerKm;

  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Combustible por km</p>
      <p className="text-3xl font-bold tracking-tight tabular-nums">
        {money(costPerKm)}
        <span className="ml-1 text-base font-semibold text-zinc-400">/km</span>
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {bars.map((bar) => (
          <div key={bar.label} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">{bar.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className={cn("h-full rounded-full", bar.className)} style={{ width: `${(bar.value / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{money(bar.value)}</span>
          </div>
        ))}
      </div>
      {lpgBelowCost && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          Con GLP cobras {money(lpgRate)}/km, pero mezclando gasolina y GLP te cuesta {money(costPerKm)}/km. Revisa la tarifa en Ajustes.
        </p>
      )}
    </Card>
  );
}

const PRESETS = ["30", "50", "100"];

function FuelForm({ lastFuel, lastOdometer, onDone }: { lastFuel: FuelType; lastOdometer: number; onDone: () => void }) {
  const notify = useNotify();
  const addLog = useAddFuelLog();
  const [fuelType, setFuelType] = useState<FuelType>(lastFuel);
  const [odometer, setOdometer] = useState(String(lastOdometer));
  const [date, setDate] = useState(today());
  const [choice, setChoice] = useState("");
  const [fullAmount, setFullAmount] = useState("");

  const isFull = choice === "FULL";
  const amount = Number(isFull ? fullAmount : choice);
  const canSave = amount > 0 && Number(odometer) > 0 && !addLog.isPending;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={fuelType}
        onChange={setFuelType}
        options={[
          { value: "GASOLINE", label: "Gasolina", icon: <Fuel /> },
          { value: "LPG", label: "GLP", icon: <Flame /> },
        ]}
      />

      <Field label="¿Cuánto echaste?">
        <div className="grid grid-cols-4 gap-2">
          {[...PRESETS, "FULL"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setChoice(preset)}
              className={cn(
                "h-14 rounded-2xl text-base font-bold transition",
                choice === preset
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800",
              )}
            >
              {preset === "FULL" ? "Full" : `S/ ${preset}`}
            </button>
          ))}
        </div>
      </Field>
      {isFull && (
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Monto del full, ej. 87.40"
          value={fullAmount}
          onChange={(e) => setFullAmount(e.target.value)}
          autoFocus
        />
      )}

      <Field label="Kilometraje">
        <OdometerInput value={odometer} onChange={setOdometer} />
      </Field>

      <Field label="Fecha">
        <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Button
        size="lg"
        variant="brand"
        disabled={!canSave}
        onClick={async () => {
          try {
            await addLog.mutateAsync({ date, odometer: Number(odometer), fuelType, amount, isFull });
            notify(`Carga de ${money(amount)} registrada`);
            onDone();
          } catch (err) {
            notify(errorMessage(err));
          }
        }}
      >
        {addLog.isPending ? <Spinner /> : <>Guardar carga{amount > 0 && ` · ${money(amount)}`}</>}
      </Button>
    </div>
  );
}
