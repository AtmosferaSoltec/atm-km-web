import { ApiError } from "./client";

// Spanish text for the field codes the API returns, so a form can say what is
// wrong instead of a generic "Revisa los datos".

const FIELD_LABELS: Record<string, string> = {
  start_km: "El kilometraje de salida",
  end_km: "El kilometraje de devolución",
  start_date: "La fecha de salida",
  return_date: "La fecha de devolución",
  odometer: "El kilometraje",
  amount: "El monto",
  date: "La fecha",
  photo: "La foto",
  gasoline_rate: "La tarifa de gasolina",
  lpg_rate: "La tarifa de GLP",
  wear_rate: "La tarifa de desgaste",
};

const CODE_TEXT: Record<string, string> = {
  REQUIRED: "es obligatorio",
  INVALID: "no es válido",
  NEGATIVE: "no puede ser negativo",
  NOT_POSITIVE: "tiene que ser mayor que cero",
  TOO_LARGE: "es demasiado grande",
  TOO_PRECISE: "tiene demasiados decimales",
  TOO_LONG: "es demasiado largo",
  IN_FUTURE: "no puede ser futura",
  BEFORE_START: "no puede ser antes de la salida",
  NOT_AFTER_START: "tiene que ser mayor que el de salida",
  UNSUPPORTED_TYPE: "tiene que ser JPG, PNG, WebP o HEIC",
  EMPTY: "está vacía",
};

/** What to tell the user about a failed request. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Algo salió mal. Inténtalo de nuevo.";
  const first = error.details[0];
  if (error.code === "VALIDATION_FAILED" && first && FIELD_LABELS[first.field] && CODE_TEXT[first.code]) {
    return `${FIELD_LABELS[first.field]} ${CODE_TEXT[first.code]}.`;
  }
  return error.message;
}
