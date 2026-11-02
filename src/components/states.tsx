import { Loader2, RotateCcw, WifiOff } from "lucide-react";

import { Button, Card } from "./ui";
import { errorMessage } from "../lib/api/errors";

/** While a screen's data arrives. Shaped like cards so the page does not jump. */
export function PageLoader() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-44 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-28 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

/** A screen whose data could not load, with a way to try again. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
        <WifiOff className="size-6" />
      </span>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{errorMessage(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        <RotateCcw /> Reintentar
      </Button>
    </Card>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={className ?? "size-5 animate-spin"} />;
}
