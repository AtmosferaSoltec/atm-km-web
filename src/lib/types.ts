// The shapes the screens use: camelCase, amounts as numbers for display. The
// Go API sends snake_case with money as strings; lib/api/mappers.ts converts.

export type FuelType = "GASOLINE" | "LPG";

export type TripStatus = "IN_PROGRESS" | "PENDING" | "PAID" | "CANCELLED";

export type Rates = {
  gasolineRate: number;
  lpgRate: number;
  wearRate: number;
};

/** An odometer photo: a signed URL, when it was taken and when it gets deleted. */
export type Photo = {
  url: string;
  takenAt: string;
  expiresAt: string;
};

export type Leg = "start" | "end";

export type Trip = {
  id: string;
  status: TripStatus;
  startDate: string;
  returnDate: string | null;
  paidDate: string | null;
  startKm: number;
  endKm: number | null;
  distanceKm: number | null;
  fuelType: FuelType | null;
  // Rates frozen when the trip closes: editing Settings never changes what was charged.
  fuelRate: number | null;
  wearRate: number | null;
  fuelAmount: number | null;
  wearAmount: number | null;
  totalAmount: number | null;
  photos: Record<Leg, Photo | null>;
};

export type FuelLog = {
  id: string;
  date: string;
  odometer: number;
  fuelType: FuelType;
  amount: number;
  /** "Fill it up": the amount is set by the pump, so it is rarely round. */
  isFull: boolean;
};

export type Settings = {
  carName: string;
  borrowerName: string;
  shareToken: string;
  rates: Rates;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
};

export type Pending = {
  count: number;
  totalAmount: number;
  trips: Trip[];
};

export type Home = {
  openTrip: Trip | null;
  pending: Pending;
  last30Days: { since: string; distanceKm: number; charged: number; fuelSpent: number };
  recentTrips: Trip[];
  lastOdometer: number;
  lastFuelType: FuelType | null;
};

export type FuelMonth = {
  key: string;
  logs: FuelLog[];
  spent: number;
  /** What was charged as fuel on that month's trips. */
  charged: number;
};

export type FuelSummary = {
  months: FuelMonth[];
  realCostPerKm: number | null;
  hasMore: boolean;
};

export type SharePage = {
  ownerName: string;
  carName: string;
  borrowerName: string;
  pending: Pending;
  history: Trip[];
};
