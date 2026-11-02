import type { FuelType, Rates } from "./types";

// Same per-km billing rule as atm-km's src/lib/billing.ts. In the remake it
// will live in the Go backend; here it powers the live preview while typing.
//
// Total = distance × (fuel rate per km + wear rate per km)

export const FUEL_LABELS: Record<FuelType, string> = {
  GASOLINE: "Gasolina",
  LPG: "GLP",
};

export type Billing = {
  fuelRate: number;
  wearRate: number;
  fuelAmount: number;
  wearAmount: number;
  totalAmount: number;
};

export function calculateBilling(distanceKm: number, fuelType: FuelType, rates: Rates): Billing {
  const fuelRate = fuelType === "GASOLINE" ? rates.gasolineRate : rates.lpgRate;
  const fuelAmount = distanceKm * fuelRate;
  const wearAmount = distanceKm * rates.wearRate;

  return {
    fuelRate,
    wearRate: rates.wearRate,
    fuelAmount,
    wearAmount,
    totalAmount: fuelAmount + wearAmount,
  };
}

export function ratePerKm(fuelType: FuelType, rates: Rates) {
  return (fuelType === "GASOLINE" ? rates.gasolineRate : rates.lpgRate) + rates.wearRate;
}
