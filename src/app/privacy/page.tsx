import type { Metadata } from "next";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Política de privacidad" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Responsable",
    body: [`[Nombre o razón social del responsable, dirección y correo de contacto — pendiente de completar antes de publicar ${brand.name}.]`],
  },
  {
    title: "2. Qué datos se tratan",
    body: [
      "Los archivos que tú importas desde la exportación oficial de Instagram o TikTok: nombres de usuario de tus seguidores y de las cuentas que sigues, y, si aparecen, nombres visibles, enlaces de perfil y fechas de seguimiento.",
      "El nombre de usuario de la cuenta que indicas para identificar el análisis.",
      "Tus preferencias de la aplicación (tema, separador CSV, opciones de guardado).",
      "No se solicitan ni se tratan contraseñas, tokens de acceso de redes sociales ni datos de pago.",
    ],
  },
  {
    title: "3. Finalidad y base jurídica",
    body: [
      "Comparar tus listas de seguidores y seguidos y mostrarte el resultado, a petición tuya. La base jurídica prevista es la ejecución del servicio solicitado por la persona usuaria (art. 6.1.b RGPD) y, para el guardado del historial, tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento.",
      "Las listas incluyen datos de terceros (otras cuentas). Se tratan únicamente para mostrártelos a ti, titular de la cuenta, con la misma información que ya te facilita la plataforma.",
    ],
  },
  {
    title: "4. Dónde se procesan y almacenan",
    body: [
      "Todo el procesamiento ocurre en tu navegador. Los archivos no se envían a ningún servidor de FollowScope ni de terceros.",
      "Por defecto no se guarda nada. Si activas el guardado, los análisis se almacenan en el almacenamiento local de tu navegador (IndexedDB) y solo en este dispositivo. Los archivos originales nunca se guardan.",
      "Las preferencias se guardan en el almacenamiento local del navegador.",
    ],
  },
  {
    title: "5. Conservación y eliminación",
    body: [
      "Los datos importados sin guardar se eliminan al cerrar o recargar la pestaña.",
      "Los análisis guardados se conservan hasta que los borres desde Historial o Ajustes («Borrar todos mis datos»), o hasta que borres los datos del sitio en tu navegador.",
    ],
  },
  {
    title: "6. Destinatarios y transferencias",
    body: ["No hay cesiones ni transferencias internacionales: los datos no salen de tu dispositivo. La aplicación no incluye analítica, publicidad ni rastreadores."],
  },
  {
    title: "7. Tus derechos",
    body: [
      "Como los datos permanecen en tu dispositivo, puedes consultarlos, exportarlos (CSV/JSON) y suprimirlos directamente desde la aplicación. Para cualquier consulta, contacta con el responsable y, si lo consideras necesario, con la autoridad de control (en España, la AEPD).",
    ],
  },
  {
    title: "8. Futuras versiones",
    body: [
      "Si en el futuro se añaden cuentas de usuario, sincronización entre dispositivos o conexiones oficiales con las plataformas, esta política se actualizará antes de activarlas y se pedirá el consentimiento cuando corresponda.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Política de privacidad" description={`Cómo trata ${brand.name} tus datos.`} />
      <Alert tone="warning" title="Borrador pendiente de revisión legal" className="mb-6">
        Este texto es un borrador inicial que describe el funcionamiento técnico real de la aplicación. Debe revisarlo un profesional jurídico y
        completarse con los datos del responsable antes de publicar el producto.
      </Alert>
      <Card>
        <CardBody className="space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-semibold">{s.title}</h2>
              <div className="mt-2 space-y-2 text-sm text-foreground/85">
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="text-xs text-muted">Última actualización: octubre de 2026 (borrador).</p>
        </CardBody>
      </Card>
    </div>
  );
}
