import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Card>
      <EmptyState title="Página no encontrada" action={<ButtonLink href="/">Volver al inicio</ButtonLink>}>
        La dirección que has abierto no existe.
      </EmptyState>
    </Card>
  );
}
