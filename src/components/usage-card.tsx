import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "./ui";
import { useUsage } from "../lib/api/queries";
import { weekLabel } from "../lib/dates";
import { cn, km } from "../lib/format";

const WEEKS = 8;

/**
 * Who drove the car: you (the odometer moved while it was home) or the
 * borrower (the trips). Private; the share page never shows it.
 */
export function UsageCard() {
  const usage = useUsage(WEEKS);
  const [open, setOpen] = useState(false);

  // A secondary card: if it cannot load, the rest of home still works.
  if (!usage.data) return null;
  const { weeks, ownerKm, borrowerKm, ownerSharePct } = usage.data;
  if (ownerKm + borrowerKm === 0) return null;

  const thisWeek = weeks[0];

  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">¿Quién usó más el auto? · {WEEKS} semanas</p>
      <Versus ownerKm={ownerKm} borrowerKm={borrowerKm} ownerName="Tú" borrowerName="Familiar" large />
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Tú hiciste el {ownerSharePct}% de los km. Esta semana: tú {km(thisWeek.ownerKm)} · Familiar{" "}
        {km(thisWeek.borrowerKm)}.
      </p>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-3 flex items-center gap-1 text-sm font-semibold text-teal"
      >
        Por semana <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {weeks.map((week) => (
            <div key={week.start}>
              <p className="mb-1 text-xs font-semibold">{weekLabel(week.start)}</p>
              <Versus ownerKm={week.ownerKm} borrowerKm={week.borrowerKm} ownerName="Tú" borrowerName="Familiar" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Versus({
  ownerKm,
  borrowerKm,
  ownerName,
  borrowerName,
  large,
}: {
  ownerKm: number;
  borrowerKm: number;
  ownerName: string;
  borrowerName: string;
  large?: boolean;
}) {
  const total = ownerKm + borrowerKm;
  const ownerWidth = total > 0 ? (ownerKm / total) * 100 : 0;
  return (
    <div className={large ? "mt-3" : ""}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-3 tabular-nums",
          large ? "text-2xl font-bold" : "text-sm font-semibold",
        )}
      >
        <span>{km(ownerKm)}</span>
        <span>{km(borrowerKm)}</span>
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="bg-brand h-full transition-all" style={{ width: `${ownerWidth}%` }} />
        <div className="h-full flex-1 bg-orange-400" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>{ownerName}</span>
        <span>{borrowerName}</span>
      </div>
    </div>
  );
}
