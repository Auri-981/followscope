/** Identificador aleatorio no adivinable (no deriva de datos personales). */
export function createId(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}
