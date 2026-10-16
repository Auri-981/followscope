const numberFormatter = new Intl.NumberFormat("es-ES");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "Fecha desconocida";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "Fecha desconocida";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return date.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

const percentFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Porcentaje formateado en español (p. ej. "53,7"), sin el símbolo. */
export function percent(part: number, total: number): string {
  if (total <= 0) return "0";
  return percentFormatter.format((part / total) * 100);
}
