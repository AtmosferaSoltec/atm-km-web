import { startOfWeek } from "./dates";
import type { Trip } from "./types";

export type TripWeek = {
  start: string;
  trips: Trip[];
  paid: number;
  pending: number;
};

/** Groups by the week the car was lent (Sunday to Saturday), newest first. */
export function groupByWeek(trips: Trip[]): TripWeek[] {
  const weeks = new Map<string, TripWeek>();
  for (const trip of trips) {
    const start = startOfWeek(trip.startDate);
    const week = weeks.get(start) ?? { start, trips: [], paid: 0, pending: 0 };
    week.trips.push(trip);
    if (trip.status === "PAID") week.paid += trip.totalAmount ?? 0;
    if (trip.status === "PENDING") week.pending += trip.totalAmount ?? 0;
    weeks.set(start, week);
  }
  return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start));
}
