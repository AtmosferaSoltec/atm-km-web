import { useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Flame, Fuel } from "lucide-react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { PageTitle, StickyAction } from "../components/app-shell";
import { ErrorState, PageLoader, Spinner } from "../components/states";
import { Receipt } from "../components/trip-bits";
import {
  EmptyLegCard,
  LegCard,
  LegDate,
  LegDateInput,
  LegKm,
  LegKmInput,
  LegPhoto,
  LegPhotoInput,
  LegsGrid,
} from "../components/trip-legs";
import { Button, Field, Segmented } from "../components/ui";
import { errorMessage } from "../lib/api/errors";
import { keys, uploadPhoto, useHome, useLend, useReceive, useSettings, useTrip } from "../lib/api/queries";
import { calculateBilling } from "../lib/billing";
import { today } from "../lib/dates";
import { km } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { useNotify } from "../lib/toast";
import type { FuelType, Home, Leg, Rates, Settings, Trip } from "../lib/types";

const FUEL_OPTIONS = [
  { value: "GASOLINE" as const, label: "Gasolina", icon: <Fuel /> },
  { value: "LPG" as const, label: "GLP", icon: <Flame /> },
];

/** State for the end leg, shared by "Recibir auto" and by lending a car that is already back. */
function useEndLeg(lastFuel: FuelType | null) {
  const [endKm, setEndKm] = useState("");
  const [returnDate, setReturnDate] = useState(today());
  const [fuelType, setFuelType] = useState<FuelType>(lastFuel ?? "GASOLINE");
  const [endPhoto, setEndPhoto] = useState<Blob | null>(null);
  return { endKm, setEndKm, returnDate, setReturnDate, fuelType, setFuelType, endPhoto, setEndPhoto };
}

type EndLeg = ReturnType<typeof useEndLeg>;

function EndLegFields({ leg, startKm, startDate, autoFocus }: { leg: EndLeg; startKm: number; startDate: string; autoFocus?: boolean }) {
  const typed = leg.endKm.trim() !== "";
  return (
    <>
      <LegKmInput
        value={leg.endKm}
        onChange={leg.setEndKm}
        placeholder={String(startKm)}
        invalid={typed && Number(leg.endKm) <= startKm}
        autoFocus={autoFocus}
      />
      <LegDateInput value={leg.returnDate} onChange={leg.setReturnDate} min={startDate} />
      <LegPhotoInput value={leg.endPhoto} onChange={leg.setEndPhoto} />
    </>
  );
}

/** Everything below the two cards once the car is back: fuel type and the live receipt. */
function Settlement({ leg, startKm, rates }: { leg: EndLeg; startKm: number; rates: Rates }) {
  const distance = Number(leg.endKm) - startKm;
  const typed = leg.endKm.trim() !== "";
  const distanceKm = typed && distance > 0 ? distance : 0;

  return (
    <>
      {typed && distance <= 0 && (
        <p className="-mt-2 text-center text-sm text-red-500">
          El kilometraje de devolución tiene que ser mayor que {km(startKm)}.
        </p>
      )}
      <Field label="¿Con qué combustible lo usó?">
        <Segmented value={leg.fuelType} onChange={leg.setFuelType} options={FUEL_OPTIONS} />
      </Field>
      <Receipt data={{ ...calculateBilling(distanceKm, leg.fuelType, rates), distanceKm, fuelType: leg.fuelType }} />
    </>
  );
}

function distanceOf(leg: EndLeg, startKm: number) {
  const distance = Number(leg.endKm) - startKm;
  return leg.endKm.trim() !== "" && distance > 0 ? distance : null;
}

/**
 * Photos go up after the trip is saved. If one fails the trip is still saved:
 * the photo can be added again from the trip detail.
 */
async function uploadPhotos(client: QueryClient, tripId: string, photos: [Leg, Blob | null][]) {
  if (photos.every(([, photo]) => !photo)) return true;
  let failed = false;
  for (const [leg, photo] of photos) {
    if (!photo) continue;
    try {
      await uploadPhoto(tripId, leg, photo);
    } catch {
      failed = true;
    }
  }
  // The trip was refetched when it was saved, before its photos existed.
  await client.invalidateQueries({ queryKey: keys.trips });
  return !failed;
}

const PHOTO_FAILED = "Viaje guardado, pero una foto no se subió. Agrégala desde el detalle.";

export function LendPage() {
  const home = useHome();
  const settings = useSettings();
  // Once the form is up it stays: saving a lend refetches home with the new
  // open trip, and that must not bounce the user to the return form.
  const formShown = useRef(false);
  if (home.error || settings.error) {
    return <ErrorState error={home.error ?? settings.error} onRetry={() => void Promise.all([home.refetch(), settings.refetch()])} />;
  }
  if (!home.data || !settings.data) return <PageLoader />;
  if (home.data.openTrip && !formShown.current) return <Navigate to={ROUTES.returnTrip(home.data.openTrip.id)} replace />;
  formShown.current = true;
  return <LendForm home={home.data} settings={settings.data} />;
}

function LendForm({ home, settings }: { home: Home; settings: Settings }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const lend = useLend();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(today());
  const [startKm, setStartKm] = useState(String(home.lastOdometer));
  const [startPhoto, setStartPhoto] = useState<Blob | null>(null);
  const [alreadyBack, setAlreadyBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const leg = useEndLeg(home.lastFuelType);

  const start = Number(startKm);
  const validStart = startKm.trim() !== "" && start >= 0;
  const validEnd = Number(leg.endKm) > start && leg.returnDate >= startDate;
  const canSave = validStart && (!alreadyBack || validEnd) && !saving;

  async function save() {
    setSaving(true);
    try {
      const trip = await lend.mutateAsync({
        startDate,
        startKm: start,
        return: alreadyBack ? { returnDate: leg.returnDate, endKm: Number(leg.endKm), fuelType: leg.fuelType } : undefined,
      });
      const photosOk = await uploadPhotos(queryClient, trip.id, [
        ["start", startPhoto],
        ["end", alreadyBack ? leg.endPhoto : null],
      ]);
      if (alreadyBack) notify(photosOk ? "Viaje registrado" : PHOTO_FAILED);
      else notify(photosOk ? `Auto prestado a ${settings.borrowerName}` : PHOTO_FAILED);
      navigate(ROUTES.home, { replace: true });
    } catch (error) {
      notify(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Prestar auto" subtitle={`A ${settings.borrowerName}`} back={ROUTES.home} />

      <LegsGrid distanceKm={alreadyBack ? distanceOf(leg, start) : null}>
        <LegCard kind="start">
          <LegKmInput value={startKm} onChange={setStartKm} />
          <LegDateInput value={startDate} onChange={setStartDate} />
          <LegPhotoInput value={startPhoto} onChange={setStartPhoto} />
        </LegCard>
        {alreadyBack ? (
          <LegCard kind="end" onRemove={() => setAlreadyBack(false)}>
            <EndLegFields leg={leg} startKm={start} startDate={startDate} autoFocus />
          </LegCard>
        ) : (
          <EmptyLegCard onAdd={() => setAlreadyBack(true)} />
        )}
      </LegsGrid>

      {Number(startKm) !== home.lastOdometer && (
        <button
          type="button"
          className="-mt-2 self-center text-sm font-semibold text-teal"
          onClick={() => setStartKm(String(home.lastOdometer))}
        >
          Usar el último kilometraje: {km(home.lastOdometer)}
        </button>
      )}

      {alreadyBack && <Settlement leg={leg} startKm={start} rates={settings.rates} />}

      <StickyAction>
        <Button size="lg" variant="brand" className="w-full" disabled={!canSave} onClick={save}>
          {saving ? <Spinner /> : alreadyBack ? "Guardar viaje" : "Entregar auto"}
        </Button>
      </StickyAction>
    </div>
  );
}

export function ReturnTripPage() {
  const { id = "" } = useParams();
  const trip = useTrip(id);
  const home = useHome();
  const settings = useSettings();
  // Same latch as LendPage: receiving refetches the trip as PENDING.
  const formShown = useRef(false);
  const error = trip.error ?? home.error ?? settings.error;
  if (error) return <ErrorState error={error} onRetry={() => void Promise.all([trip.refetch(), home.refetch(), settings.refetch()])} />;
  if (!trip.data || !home.data || !settings.data) return <PageLoader />;
  if (trip.data.status !== "IN_PROGRESS" && !formShown.current) return <Navigate to={ROUTES.trip(trip.data.id)} replace />;
  formShown.current = true;
  return <ReturnForm trip={trip.data} lastFuel={home.data.lastFuelType} settings={settings.data} />;
}

function ReturnForm({ trip, lastFuel, settings }: { trip: Trip; lastFuel: FuelType | null; settings: Settings }) {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const receive = useReceive();
  const queryClient = useQueryClient();
  const leg = useEndLeg(lastFuel);
  const [saving, setSaving] = useState(false);

  const canSave = Number(leg.endKm) > trip.startKm && leg.returnDate >= trip.startDate && !saving;

  async function save() {
    setSaving(true);
    try {
      await receive.mutateAsync({ tripId: trip.id, returnDate: leg.returnDate, endKm: Number(leg.endKm), fuelType: leg.fuelType });
      const photosOk = await uploadPhotos(queryClient, trip.id, [["end", leg.endPhoto]]);
      notify(photosOk ? "Auto recibido · queda por cobrar" : PHOTO_FAILED);
      // Back to wherever the user came from (home or the trip's detail).
      if (location.key === "default") navigate(ROUTES.home, { replace: true });
      else navigate(-1);
    } catch (error) {
      notify(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Recibir auto" subtitle={`De ${settings.borrowerName}`} back={ROUTES.home} />

      <LegsGrid distanceKm={distanceOf(leg, trip.startKm)}>
        <LegCard kind="start">
          <LegKm value={trip.startKm} />
          <LegDate value={trip.startDate} />
          <LegPhoto photo={trip.photos.start} />
        </LegCard>
        <LegCard kind="end">
          <EndLegFields leg={leg} startKm={trip.startKm} startDate={trip.startDate} autoFocus />
        </LegCard>
      </LegsGrid>

      <Settlement leg={leg} startKm={trip.startKm} rates={settings.rates} />

      <Link
        to={ROUTES.trip(trip.id)}
        className="self-center py-2 text-sm font-semibold text-zinc-500 underline-offset-2 hover:underline"
      >
        ¿No se usó? Cancelar préstamo
      </Link>

      <StickyAction>
        <Button size="lg" variant="brand" className="w-full" disabled={!canSave} onClick={save}>
          {saving ? <Spinner /> : "Recibir auto"}
        </Button>
      </StickyAction>
    </div>
  );
}
