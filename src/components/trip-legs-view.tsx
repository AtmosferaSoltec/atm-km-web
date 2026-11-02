import { LegCard, LegDate, LegKm, LegPhoto, LegPhotoEditor, LegsGrid } from "./trip-legs";
import type { Trip } from "../lib/types";

/**
 * Start and end legs of a saved trip. With `editable` (the owner's trip detail)
 * photos can be added, replaced or removed; the share page shows them only.
 */
export function TripLegsView({ trip, editable = false }: { trip: Trip; editable?: boolean }) {
  const canEdit = editable && trip.status !== "CANCELLED";
  return (
    <LegsGrid distanceKm={trip.distanceKm}>
      <LegCard kind="start">
        <LegKm value={trip.startKm} />
        <LegDate value={trip.startDate} />
        {canEdit ? (
          <LegPhotoEditor tripId={trip.id} leg="start" photo={trip.photos.start} />
        ) : (
          <LegPhoto photo={trip.photos.start} />
        )}
      </LegCard>
      <LegCard kind="end">
        {trip.endKm != null ? (
          <>
            <LegKm value={trip.endKm} />
            <LegDate value={trip.returnDate} />
            {canEdit ? (
              <LegPhotoEditor tripId={trip.id} leg="end" photo={trip.photos.end} />
            ) : (
              <LegPhoto photo={trip.photos.end} />
            )}
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center px-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {trip.status === "IN_PROGRESS" ? "Todavía no lo devuelve" : "No se devolvió: se canceló"}
          </p>
        )}
      </LegCard>
    </LegsGrid>
  );
}
