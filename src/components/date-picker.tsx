import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { CalendarDays, X } from "lucide-react";

import { formatLong, formatShort, formatWeekday, today } from "../lib/dates";
import { cn } from "../lib/format";

// Dates travel as "YYYY-MM-DD" strings everywhere in the app; the calendar
// works with local Dates, so these two convert at the edge.
function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A date field that opens a calendar instead of the browser's own picker, which
 * looks different (and worse) on every device. The calendar is a dialog so it
 * is never clipped by a sheet and fits half-width fields too.
 */
export function DatePicker({
  value,
  onChange,
  label = "Fecha",
  min,
  max = today(),
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Earliest day that can be picked ("YYYY-MM-DD"). */
  min?: string;
  /** Latest day that can be picked: today unless told otherwise. */
  max?: string;
  /** Smaller, for fields that sit side by side. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={cn(
          "px-1 font-medium",
          compact ? "pl-1 text-[11px] text-zinc-500 dark:text-zinc-400" : "text-sm text-zinc-700 dark:text-zinc-300",
        )}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 text-left font-semibold ring-teal outline-none transition focus-visible:ring-2",
          compact
            ? "h-11 rounded-2xl bg-zinc-100 px-3 text-sm dark:bg-zinc-800"
            : "h-12 rounded-2xl bg-white px-4 text-base ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate">
          {compact ? `${formatWeekday(value)} ${formatShort(value)}` : formatLong(value)}
        </span>
      </button>
      <CalendarDialog
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        min={min}
        max={max}
        onPick={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
      />
    </div>
  );
}

function CalendarDialog({
  open,
  onClose,
  title,
  value,
  min,
  max,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string;
  min?: string;
  max: string;
  onPick: (iso: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    // Capture phase: Escape closes only the calendar, not the sheet behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const selected = toDate(value);
  const maxDate = toDate(max);
  const minDate = min ? toDate(min) : undefined;
  const todayIso = today();
  const canPickToday = todayIso <= max && (!min || todayIso >= min);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative w-full max-w-xs rounded-[2rem] bg-white p-4 shadow-xl dark:bg-zinc-900"
      >
        <div className="mb-1 flex items-center justify-between pl-2">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="size-5" />
          </button>
        </div>
        <DayPicker
          mode="single"
          locale={es}
          weekStartsOn={0}
          selected={selected}
          defaultMonth={selected}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[{ after: maxDate }, ...(minDate ? [{ before: minDate }] : [])]}
          onSelect={(date) => date && onPick(toIso(date))}
          className="mx-auto"
        />
        {canPickToday && (
          <button
            type="button"
            onClick={() => onPick(todayIso)}
            className="mt-2 h-11 w-full rounded-xl bg-zinc-100 text-sm font-semibold transition active:scale-[0.98] dark:bg-zinc-800"
          >
            Hoy
          </button>
        )}
      </div>
    </div>
  );
}
