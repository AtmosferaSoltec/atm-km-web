import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { DatePicker } from "./date-picker";
import { LegPhoto, LegPhotoInput } from "./trip-legs";
import { Spinner } from "./states";
import { Button, Card, Field, Input, Sheet } from "./ui";
import { errorMessage } from "../lib/api/errors";
import { useAddVoucher, useDeleteVoucher } from "../lib/api/queries";
import { formatShort, today } from "../lib/dates";
import { cn, money } from "../lib/format";
import { useNotify } from "../lib/toast";
import type { Voucher } from "../lib/types";

const ALT = "Foto del voucher";

/** A voucher the borrower paid: its photo, the amount and the day. Deletable by the owner. */
export function VoucherCard({ voucher, onDelete, deleting }: { voucher: Voucher; onDelete?: () => void; deleting?: boolean }) {
  return (
    <Card className="flex flex-col gap-2 p-2">
      <LegPhoto photo={voucher.photo} alt={ALT} />
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="min-w-0">
          <p className="text-sm font-bold tabular-nums">{money(voucher.amount)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatShort(voucher.date)}</p>
        </div>
        {onDelete && (
          <button
            type="button"
            aria-label="Borrar voucher"
            disabled={deleting}
            onClick={onDelete}
            className="grid size-8 place-items-center rounded-full text-zinc-300 transition hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950/40"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </Card>
  );
}

/** The borrower's vouchers (credit not yet discounted) and the form to add one. */
export function VouchersSheet({
  open,
  onClose,
  vouchers,
}: {
  open: boolean;
  onClose: () => void;
  vouchers: Voucher[];
}) {
  const notify = useNotify();
  const remove = useDeleteVoucher();

  return (
    <Sheet open={open} onClose={onClose} title="Vouchers de combustible">
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Lo que tu familiar pagó de gasolina mientras usaba el auto. Se descuenta de lo que debe cuando le cobras.
      </p>
      <VoucherForm />
      {vouchers.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {vouchers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              deleting={remove.isPending}
              onDelete={async () => {
                try {
                  await remove.mutateAsync(voucher.id);
                  notify("Voucher borrado");
                } catch (error) {
                  notify(errorMessage(error));
                }
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function VoucherForm() {
  const notify = useNotify();
  const add = useAddVoucher();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<Blob | null>(null);
  const canSave = Number(amount) > 0 && date !== "" && !add.isPending;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Monto del voucher">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="Ej. 50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <DatePicker value={date} onChange={setDate} />
      <div className="w-28">
        <LegPhotoInput value={photo} onChange={setPhoto} alt={ALT} />
      </div>
      <Button
        variant="brand"
        size="lg"
        disabled={!canSave}
        onClick={async () => {
          try {
            const { photoFailed } = await add.mutateAsync({ date, amount: Number(amount), photo });
            notify(photoFailed ? "Voucher guardado, pero la foto no se pudo subir" : `Voucher de ${money(Number(amount))} guardado`);
            setAmount("");
            setPhoto(null);
          } catch (error) {
            notify(errorMessage(error));
          }
        }}
      >
        {add.isPending ? <Spinner /> : "Guardar voucher"}
      </Button>
    </div>
  );
}

/** A voucher row that is ticked instead of opened: used to choose which vouchers go in a payment. */
export function SelectableVoucherRow({ voucher, selected, onToggle }: { voucher: Voucher; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition active:bg-zinc-100 dark:active:bg-zinc-800/50"
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-lg ring-2 transition",
          selected ? "bg-brand text-ink ring-transparent" : "bg-white ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Voucher del {formatShort(voucher.date)}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{voucher.photo ? "Con foto" : "Sin foto"}</p>
      </div>
      <span className="text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">−{money(voucher.amount)}</span>
    </button>
  );
}
