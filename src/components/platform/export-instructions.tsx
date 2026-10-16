import { ChevronDown } from "lucide-react";
import type { Platform } from "@/domain/types";

const STEPS: Record<Platform, { steps: string[]; note: string }> = {
  instagram: {
    steps: [
      "En Instagram, abre tu perfil → menú ☰ → Centro de cuentas → Tu información y permisos → Descargar tu información.",
      "Elige «Descargar o transferir información», selecciona tu cuenta de Instagram y después «Parte de tu información».",
      "Marca solo «Seguidores y seguidos» (en Conexiones). Así el archivo será pequeño.",
      "Elige «Descargar en el dispositivo», intervalo «Desde el principio» y formato JSON (no HTML).",
      "Cuando Meta te avise de que está lista, descarga el ZIP e impórtalo aquí tal cual, sin descomprimir.",
    ],
    note: "Contiene followers_1.json (puede haber varios: followers_2.json…) y following.json. Los menús de Instagram cambian a menudo; si no encuentras una opción, busca «Descargar tu información» en los ajustes.",
  },
  tiktok: {
    steps: [
      "En TikTok, ve a tu perfil → menú ☰ → Ajustes y privacidad → Cuenta → Descargar tus datos.",
      "En «Seleccionar datos», asegúrate de incluir «Seguidores» y «Siguiendo» (dentro de Actividad).",
      "Elige el formato JSON (también se admite TXT) y pulsa «Solicitar datos».",
      "Cuando esté lista (puede tardar unos días), descárgala desde la pestaña «Descargar datos».",
      "Importa aquí el ZIP o el archivo user_data_tiktok.json.",
    ],
    note: "La exportación incluye la lista de seguidores y la de seguidos en el mismo archivo. TikTok la mantiene disponible para descarga solo durante unos días.",
  },
};

export function ExportInstructions({ platform }: { platform: Platform }) {
  const { steps, note } = STEPS[platform];
  return (
    <details className="group rounded-xl border border-border bg-surface-2/60 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
        ¿Cómo consigo mi exportación de {platform === "instagram" ? "Instagram" : "TikTok"}?
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border px-4 py-4 text-sm">
        <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">{note}</p>
        <p className="mt-2 text-xs text-muted">
          También puedes usar la plantilla CSV de FollowScope (columnas <code>username</code>, <code>display_name</code>, <code>list</code>):{" "}
          <a href="/samples/plantilla-followscope.csv" download className="font-medium text-primary hover:underline">
            descargar plantilla
          </a>
          .
        </p>
      </div>
    </details>
  );
}
