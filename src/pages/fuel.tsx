import { useState } from "react";
import { Camera, Flame, Fuel, Plus, Receipt, Trash2 } from "lucide-react";

import { PageTitle } from "../components/app-shell";
import { DatePicker } from "../components/date-picker";
import { ErrorState, PageLoader, Spinner } from "../components/states";
import { PhotoFileButton, PhotoThumb, PhotoViewer, LegPhotoInput } from "../components/trip-legs";
import { Button, Card, Field, Input, Segmented, Sheet } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import {
  useAddFuelLog,
  useDeleteFuelLog,
  useDeleteFuelPhoto,
  useFuelSummary,
  useHome,
  useSetFuelPhoto,
  useSettings,
  useUpdateFuelLog,
} from "../lib/api/queries";
import { FUEL_LABELS } from "../lib/billing";
import { formatMonth, formatRelative, today } from "../lib/dates";
import { cn, km, money } from "../lib/format";
import { compressPhoto } from "../lib/photos";
import { useNotify } from "../lib/toast";
import type { FuelLog, FuelType } from "../lib/types";

/** Months shown at first, and how many more each "ver anteriores" adds. */
const MONTHS_STEP = 6;

export function FuelPage() {
  const notify = useNotify();
  const [months, setMonths] = useState(MONTHS_STEP);
  const summary = useFuelSummary(months);
  const settings = useSettings();
  const home = useHome();
  const deleteLog = useDeleteFuelLog();
  // The sheet is for a new record (null log) or for correcting one.
  // It keeps the id, not the log, so the sheet shows the saved data (a photo just uploaded) right away.
  const [sheet, setSheet] = useState<{ logId: string | null } | null>(null);

  const error = summary.error ?? settings.error ?? home.error;
  if (error) {
    return <ErrorState error={error} onRetry={() => void Promise.all([summary.refetch(), settings.refetch(), home.refetch()])} />;
  }
  if (!summary.data || !settings.data || !home.data) return <PageLoader />;

  const rates = settings.data.rates;
  const costPerKm = summary.data.realCostPerKm;
  const editing = sheet?.logId ? (summary.data.months.flatMap((m) => m.logs).find((l) => l.id === sheet.logId) ?? null) : null;
  const lastFuel = summary.data.months[0]?.logs[0]?.fuelType ?? "GASOLINE";

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Combustible"
        subtitle="Solo lo ves tú"
        action={
          <Button variant="brand" onClick={() => setSheet({ logId: null })}>
            <Plus /> Registrar
          </Button>
        }
      />

      {costPerKm !== null && <CostInsight costPerKm={costPerKm} gasolineRate={rates.gasolineRate} lpgRate={rates.lpgRate} />}

      {summary.data.months.length === 0 && (
        <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Registra tu combustible para ver cuánto te cuesta el auto por km.
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
                  <div key={log.id} className="flex items-center transition active:bg-zinc-50 dark:active:bg-zinc-800/40">
                    <button
                      type="button"
                      aria-label="Editar registro"
                      onClick={() => setSheet({ logId: log.id })}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-4 text-left"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-2xl",
                          log.fuelType === "LPG"
                            ? "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
                            : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
                        )}
                      >
                        {log.fuelType === "LPG" ? <Flame className="size-[18px]" /> : <Fuel className="size-[18px]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center text-sm font-semibold">
                          {FUEL_LABELS[log.fuelType]}
                          {log.isFull && (
                            <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">
                              FULL
                            </span>
                          )}
                          {log.photo && <Receipt aria-label="Con comprobante" className="ml-2 size-3.5 text-zinc-400" />}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {formatRelative(log.date)} · {km(log.odometer)}
                          {log.pricePerGallon !== null && ` · ${money(log.pricePerGallon)}/gal`}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{money(log.amount)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Borrar registro"
                      disabled={deleteLog.isPending}
                      onClick={async () => {
                        try {
                          await deleteLog.mutateAsync(log.id);
                          notify("Registro borrado");
                        } catch (err) {
                          notify(errorMessage(err));
                        }
                      }}
                      className="mr-3 grid size-8 shrink-0 place-items-center rounded-full text-zinc-300 transition hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950/40"
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

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={editing ? "Editar registro" : "Registrar combustible"}>
        {sheet && (sheet.logId === null || editing) && (
          <FuelForm
            key={sheet.logId ?? "new"}
            log={editing}
            lastFuel={lastFuel}
            lastOdometer={home.data.lastOdometer}
            onDone={() => setSheet(null)}
          />
        )}
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

/**
 * Registers a fill-up, or corrects one when `log` is given. The order follows
 * how it happens at the pump: the fuel, its price, how much was paid, then the
 * odometer and the day. The receipt photo is optional.
 */
function FuelForm({
  log,
  lastFuel,
  lastOdometer,
  onDone,
}: {
  log: FuelLog | null;
  lastFuel: FuelType;
  lastOdometer: number;
  onDone: () => void;
}) {
  const notify = useNotify();
  const addLog = useAddFuelLog();
  const updateLog = useUpdateFuelLog();
  // A new record starts with the fuel used last time.
  const [fuelType, setFuelType] = useState<FuelType>(log?.fuelType ?? lastFuel);
  const [pricePerGallon, setPricePerGallon] = useState(log?.pricePerGallon != null ? String(log.pricePerGallon) : "");
  const [amountText, setAmountText] = useState(log ? String(log.amount) : "");
  const [odometer, setOdometer] = useState(String(log?.odometer ?? lastOdometer));
  const [date, setDate] = useState(log?.date ?? today());
  const [photo, setPhoto] = useState<Blob | null>(null);

  const amount = Number(amountText);
  const price = Number(pricePerGallon);
  const pending = addLog.isPending || updateLog.isPending;
  const canSave = amount > 0 && Number(odometer) > 0 && !pending;

  async function save() {
    const input = {
      date,
      odometer: Number(odometer),
      fuelType,
      amount,
      // Registers are no longer marked "full"; an old one keeps what it had.
      isFull: log?.isFull ?? false,
      pricePerGallon: price > 0 ? price : undefined,
    };
    try {
      if (log) {
        await updateLog.mutateAsync({ id: log.id, ...input });
        notify("Cambios guardados");
      } else {
        const { photoFailed } = await addLog.mutateAsync({ ...input, photo });
        notify(photoFailed ? "Registrado, pero la foto no se pudo subir" : `Registro de ${money(amount)} guardado`);
      }
      onDone();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio por galón">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Opcional"
            value={pricePerGallon}
            onChange={(e) => setPricePerGallon(e.target.value)}
          />
        </Field>
        <Field label="¿Cuánto echaste?">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="S/ 0.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Kilometraje">
        <Input type="number" inputMode="decimal" min="0" placeholder="km" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </Field>

      <DatePicker value={date} onChange={setDate} />

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Foto del comprobante (opcional)</span>
        <div className="w-28">
          {log ? <ReceiptPhoto log={log} /> : <LegPhotoInput value={photo} onChange={setPhoto} alt="Foto del comprobante" />}
        </div>
      </div>

      <Button size="lg" variant="brand" disabled={!canSave} onClick={save}>
        {pending ? <Spinner /> : log ? "Guardar cambios" : <>Registrar{amount > 0 && ` · ${money(amount)}`}</>}
      </Button>
    </div>
  );
}

/** A saved record's receipt: add, view, replace or remove it right away, like a trip's photos. */
function ReceiptPhoto({ log }: { log: FuelLog }) {
  const notify = useNotify();
  const setPhoto = useSetFuelPhoto();
  const deletePhoto = useDeleteFuelPhoto();
  const [viewing, setViewing] = useState(false);

  async function upload(file: File) {
    try {
      await setPhoto.mutateAsync({ id: log.id, photo: await compressPhoto(file) });
      setViewing(false);
      notify("Foto guardada");
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  if (!log.photo) {
    return (
      <PhotoFileButton busy={setPhoto.isPending} onPick={upload}>
        <Camera className="size-5" />
        <span>Agregar foto</span>
      </PhotoFileButton>
    );
  }

  return (
    <>
      <PhotoThumb url={log.photo.url} alt="Foto del comprobante" onClick={() => setViewing(true)} />
      <PhotoViewer photo={log.photo} alt="Foto del comprobante" open={viewing} onClose={() => setViewing(false)}>
        <div className="grid grid-cols-2 gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-white">
            <Camera className="size-4" /> {setPhoto.isPending ? "Subiendo…" : "Cambiar"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={setPhoto.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={deletePhoto.isPending}
            onClick={async () => {
              try {
                await deletePhoto.mutateAsync(log.id);
                setViewing(false);
                notify("Foto quitada");
              } catch (error) {
                notify(errorMessage(error));
              }
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-red-300"
          >
            <Trash2 className="size-4" /> Quitar
          </button>
        </div>
      </PhotoViewer>
    </>
  );
}
