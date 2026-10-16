import { z } from "zod";

/**
 * Preferencias del usuario. Se guardan en localStorage (no contienen datos de
 * cuentas). Por defecto NO se guarda el historial: privacidad por defecto.
 */
export const settingsSchema = z.object({
  /** Guardar automáticamente cada análisis en este dispositivo. */
  autoSave: z.boolean().default(false),
  /** Al guardar, incluir las listas completas (necesario para comparar análisis). */
  saveLists: z.boolean().default(true),
  csvSeparator: z.enum([",", ";"]).default(","),
  theme: z.enum(["system", "light", "dark"]).default("system"),
});
export type Settings = z.infer<typeof settingsSchema>;

export const SETTINGS_KEY = "followscope:settings";
export const defaultSettings: Settings = settingsSchema.parse({});

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function storeSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Almacenamiento no disponible (modo privado): las preferencias duran solo esta sesión.
  }
}

export function applyTheme(theme: Settings["theme"]): void {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Script en línea que aplica el tema antes del primer pintado (evita parpadeo). */
export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`;
