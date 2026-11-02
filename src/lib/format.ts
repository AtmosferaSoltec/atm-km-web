const moneyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

export function money(value: number) {
  return moneyFormatter.format(value);
}

export function num(value: number) {
  return numberFormatter.format(value);
}

export function km(value: number) {
  return `${num(value)} km`;
}

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
