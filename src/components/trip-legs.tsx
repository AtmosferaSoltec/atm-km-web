import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Camera, Check, ImageOff, Loader2, Trash2, X } from "lucide-react";

import { DatePicker } from "./date-picker";
import { errorMessage } from "../lib/api/errors";
import { useDeletePhoto, useSetPhoto } from "../lib/api/queries";
import { formatShort, formatWeekday, localDay } from "../lib/dates";
import { cn, num } from "../lib/format";
import { compressPhoto } from "../lib/photos";
import { useNotify } from "../lib/toast";
import type { Leg, Photo } from "../lib/types";

// A trip has two legs: when the car leaves (start) and when it comes back
// (end). They sit side by side, each in its own card and with the same field
// order (km, date, photo), so comparing them is a horizontal glance instead of
// scrolling between two stacked sections. Built for phone width first.

type LegKind = "start" | "end";

const LEG_TITLES: Record<LegKind, string> = {
  start: "Salida",
  end: "Devolución",
};

export function LegsGrid({ children, distanceKm }: { children: ReactNode; distanceKm?: number | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid w-full grid-cols-2 gap-2">
        {children}
        <span className="pointer-events-none absolute top-3 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-zinc-100 text-zinc-400 ring-4 ring-zinc-100 dark:bg-zinc-950 dark:ring-zinc-950">
          <ArrowRight className="size-4" />
        </span>
      </div>
      {distanceKm != null && distanceKm > 0 && (
        <span className="rounded-full bg-teal/15 px-3 py-1 text-sm font-bold text-teal tabular-nums">
          Recorrió {num(distanceKm)} km
        </span>
      )}
    </div>
  );
}

export function LegCard({
  kind,
  children,
  onRemove,
}: {
  kind: LegKind;
  children: ReactNode;
  /** Only for an optional leg the user added, to take it back out. */
  onRemove?: () => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-3xl bg-white p-3 ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
      <header className="flex h-7 items-center justify-between gap-1 pl-1">
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <span className={cn("size-2 rounded-full", kind === "start" ? "bg-sky-500" : "bg-teal")} />
          {LEG_TITLES[kind]}
        </h3>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar devolución"
            className="grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="size-4" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** Placeholder for an end leg that has not happened yet; tapping it adds the leg. */
export function EmptyLegCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-300 p-3 text-center transition active:scale-[0.98] dark:border-zinc-700"
    >
      <span className="grid size-10 place-items-center rounded-full bg-teal/15 text-teal">
        <Check className="size-5" />
      </span>
      <span className="text-sm font-bold">¿Ya te lo devolvió?</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Toca para anotar la devolución ahora</span>
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="pl-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{children}</span>;
}

// Read-only values use the same box heights as the inputs, so the rows of a
// read-only card line up with the editable card next to it.
export function LegKm({ value }: { value: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>Kilometraje</FieldLabel>
      <p className="flex h-12 items-baseline gap-1 rounded-2xl bg-zinc-50 px-3 pt-2.5 text-xl font-bold tracking-tight tabular-nums dark:bg-zinc-800/40">
        {value != null ? num(value) : "—"}
        {value != null && <span className="text-xs font-semibold text-zinc-400">km</span>}
      </p>
    </div>
  );
}

export function LegKmInput({
  value,
  onChange,
  placeholder,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>Kilometraje</FieldLabel>
      <span
        className={cn(
          "flex h-12 items-baseline gap-1 rounded-2xl bg-zinc-100 px-3 pt-2.5 ring-teal transition focus-within:ring-2 dark:bg-zinc-800",
          invalid && "ring-2 ring-red-400",
        )}
      >
        <input
          type="number"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-xl font-bold tracking-tight tabular-nums outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />
        <span className="text-xs font-semibold text-zinc-400">km</span>
      </span>
    </label>
  );
}

export function LegDate({ value }: { value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>Fecha</FieldLabel>
      <p className="flex h-11 items-center rounded-2xl bg-zinc-50 px-3 text-sm font-semibold dark:bg-zinc-800/40">
        {value ? `${formatWeekday(value)} ${formatShort(value)}` : "—"}
      </p>
    </div>
  );
}

export function LegDateInput({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  return <DatePicker compact value={value} onChange={onChange} min={min} />;
}

/** A saved leg's photo: its thumbnail opens the viewer. Read-only. */
export function LegPhoto({ photo, alt = "Foto del odómetro" }: { photo: Photo | null; alt?: string }) {
  const [viewing, setViewing] = useState(false);
  if (!photo) {
    return (
      <div className={cn(TILE, "border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700")}>
        <ImageOff className="size-5" />
        <span>Sin foto</span>
      </div>
    );
  }
  return (
    <>
      <PhotoThumb url={photo.url} alt={alt} onClick={() => setViewing(true)} />
      <PhotoViewer photo={photo} alt={alt} open={viewing} onClose={() => setViewing(false)} />
    </>
  );
}

/** Picks a photo in a form, before the trip exists: it uploads on save. */
export function LegPhotoInput({
  value,
  onChange,
  alt = "Foto del odómetro",
}: {
  value: Blob | null;
  onChange: (photo: Blob | null) => void;
  alt?: string;
}) {
  const preview = useObjectUrl(value);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative">
      <PhotoFileButton
        busy={busy}
        onPick={async (file) => {
          setBusy(true);
          try {
            onChange(await compressPhoto(file));
          } finally {
            setBusy(false);
          }
        }}
      >
        {preview ? (
          <img src={preview} alt={alt} className="absolute inset-0 size-full rounded-2xl object-cover" />
        ) : (
          <>
            <Camera className="size-5" />
            <span>Agregar foto</span>
          </>
        )}
      </PhotoFileButton>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Quitar foto"
          className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** A saved trip's photo for its owner: add, view, replace or remove it. */
export function LegPhotoEditor({ tripId, leg, photo }: { tripId: string; leg: Leg; photo: Photo | null }) {
  const notify = useNotify();
  const setPhoto = useSetPhoto();
  const deletePhoto = useDeletePhoto();
  const [viewing, setViewing] = useState(false);

  async function upload(file: File) {
    try {
      await setPhoto.mutateAsync({ tripId, leg, photo: await compressPhoto(file) });
      setViewing(false);
      notify("Foto guardada");
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  if (!photo) {
    return (
      <PhotoFileButton busy={setPhoto.isPending} onPick={upload}>
        <Camera className="size-5" />
        <span>Agregar foto</span>
      </PhotoFileButton>
    );
  }

  return (
    <>
      <PhotoThumb url={photo.url} alt="Foto del odómetro" onClick={() => setViewing(true)} />
      <PhotoViewer photo={photo} alt="Foto del odómetro" open={viewing} onClose={() => setViewing(false)}>
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
                if (file) upload(file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={deletePhoto.isPending}
            onClick={async () => {
              try {
                await deletePhoto.mutateAsync({ tripId, leg });
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

const TILE =
  "relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition";

export function PhotoThumb({ url, alt, onClick }: { url: string; alt: string; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ver foto"
      className={cn(TILE, "overflow-hidden bg-zinc-200 text-zinc-500 active:scale-[0.98] dark:bg-zinc-800")}
    >
      {failed ? (
        <>
          <ImageOff className="size-5" />
          <span>No cargó</span>
        </>
      ) : (
        <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      )}
    </button>
  );
}

export function PhotoFileButton({ busy, onPick, children }: { busy: boolean; onPick: (file: File) => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        TILE,
        "cursor-pointer border border-dashed border-zinc-300 text-zinc-400 active:scale-[0.98] dark:border-zinc-700",
        busy && "pointer-events-none opacity-60",
      )}
    >
      {busy ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          <span>Procesando…</span>
        </>
      ) : (
        children
      )}
      {/* No "capture": the phone offers camera or gallery. */}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

/** Full-screen photo, with when it was taken and when it gets deleted. */
export function PhotoViewer({
  photo,
  alt,
  open,
  onClose,
  children,
}: {
  photo: Photo;
  alt: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm">
          <span className="font-semibold">Tomada el {formatShort(localDay(photo.takenAt))}</span>
          <span className="block text-xs text-zinc-400">Se borra sola el {formatShort(localDay(photo.expiresAt))}</span>
        </p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-white/10">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2" onClick={onClose}>
        <img src={photo.url} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" />
      </div>
      {children && <div className="mx-auto w-full max-w-lg px-4 pt-3">{children}</div>}
    </div>
  );
}

function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
