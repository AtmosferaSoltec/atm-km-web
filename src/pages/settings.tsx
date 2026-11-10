import { useState } from "react";
import { Copy, ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { PageTitle } from "../components/app-shell";
import { ErrorState, PageLoader, Spinner } from "../components/states";
import { Button, Card, SectionTitle, Sheet } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import { useRotateShareToken, useSettings, useUpdateRates } from "../lib/api/queries";
import { useAuth, useUser } from "../lib/auth";
import { money } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { useNotify } from "../lib/toast";
import type { Rates, Settings } from "../lib/types";

const FIELDS: { key: keyof Rates; label: string; unit: string }[] = [
  { key: "gasolineRate", label: "Combustible · gasolina", unit: "/km" },
  { key: "lpgRate", label: "Combustible · GLP", unit: "/km" },
  { key: "wearRate", label: "Desgaste y uso", unit: "/km" },
];

export function SettingsPage() {
  const settings = useSettings();
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  if (!settings.data) return <PageLoader />;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Ajustes" />
      <RatesSection settings={settings.data} />
      <ShareSection settings={settings.data} />
      <AccountSection />
    </div>
  );
}

function RatesSection({ settings }: { settings: Settings }) {
  const notify = useNotify();
  const updateRates = useUpdateRates();
  const { rates } = settings;
  const [draft, setDraft] = useState<Record<keyof Rates, string>>({
    gasolineRate: String(rates.gasolineRate),
    lpgRate: String(rates.lpgRate),
    wearRate: String(rates.wearRate),
  });

  const parsed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as Rates;
  const valid = Object.values(draft).every((v) => v.trim() !== "") && Object.values(parsed).every((v) => Number.isFinite(v) && v >= 0);
  const dirty = FIELDS.some(({ key }) => parsed[key] !== rates[key]);

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Tarifas</SectionTitle>
      <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
        {FIELDS.map(({ key, label, unit }) => (
          <label key={key} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">{label}</span>
            <span className="flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              <span className="text-sm text-zinc-400">S/</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="w-14 bg-transparent text-right text-sm font-bold tabular-nums outline-none"
              />
              <span className="text-xs text-zinc-400">{unit}</span>
            </span>
          </label>
        ))}
      </Card>
      {valid && (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          Ejemplo: 100 km con gasolina = {money(100 * (parsed.gasolineRate + parsed.wearRate))} · con GLP ={" "}
          {money(100 * (parsed.lpgRate + parsed.wearRate))}. Los viajes ya registrados conservan su tarifa.
        </p>
      )}
      {dirty && (
        <Button
          variant="brand"
          disabled={!valid || updateRates.isPending}
          onClick={async () => {
            try {
              await updateRates.mutateAsync(parsed);
              notify("Tarifas guardadas");
            } catch (error) {
              notify(errorMessage(error));
            }
          }}
        >
          {updateRates.isPending ? <Spinner /> : "Guardar tarifas"}
        </Button>
      )}
    </section>
  );
}

function ShareSection({ settings }: { settings: Settings }) {
  const notify = useNotify();
  const rotate = useRotateShareToken();
  const [confirming, setConfirming] = useState(false);
  const shareUrl = location.origin + ROUTES.share(settings.shareToken);

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Enlace para tu familiar</SectionTitle>
      <Card className="p-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ve lo que te debe y sus viajes, sin contraseña. No muestra tu combustible.
        </p>
        <code className="mt-3 block truncate rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">{shareUrl}</code>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                notify("Enlace copiado");
              } catch {
                notify("No se pudo copiar");
              }
            }}
          >
            <Copy /> Copiar
          </Button>
          <Link
            to={ROUTES.share(settings.shareToken)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
          >
            <ExternalLink className="size-4" /> Ver como tu familiar
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-zinc-500"
        >
          <RefreshCw className="size-3.5" /> Cambiar enlace
        </button>
      </Card>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="¿Cambiar el enlace?">
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
          El enlace actual deja de funcionar y se crea uno nuevo. Úsalo si lo compartiste con alguien por error.
        </p>
        <Button
          size="lg"
          variant="brand"
          className="w-full"
          disabled={rotate.isPending}
          onClick={async () => {
            try {
              await rotate.mutateAsync(undefined);
              setConfirming(false);
              notify("Enlace nuevo listo");
            } catch (error) {
              notify(errorMessage(error));
            }
          }}
        >
          {rotate.isPending ? <Spinner /> : "Crear enlace nuevo"}
        </Button>
      </Sheet>
    </section>
  );
}

function AccountSection() {
  const user = useUser();
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Cuenta</SectionTitle>
      <Card className="p-4">
        <p className="text-sm font-semibold">{user.displayName}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">@{user.username}</p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Las fotos del odómetro se borran solas a los 90 días para no ocupar espacio. Los viajes y montos se quedan.
        </p>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await logout();
          }}
        >
          {leaving ? <Spinner /> : <><LogOut /> Cerrar sesión</>}
        </Button>
      </Card>
    </section>
  );
}
