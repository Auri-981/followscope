import { UserCheck, UserPlus, UserX, type LucideIcon } from "lucide-react";
import type { CategoryKey, ComparedAccount } from "@/domain/types";
import { CATEGORY_LABELS } from "@/export/exporters";

export const categoryMeta: Record<
  CategoryKey,
  { label: string; short: string; description: string; icon: LucideIcon; tone: "mutual" | "notback" | "youonly"; emptyTitle: string; emptyText: string }
> = {
  mutualFollows: {
    label: CATEGORY_LABELS.mutualFollows,
    short: "Mutuos",
    description: "Cuentas que sigues y que también te siguen.",
    icon: UserCheck,
    tone: "mutual",
    emptyTitle: "No hay seguimientos mutuos",
    emptyText: "Ninguna de las cuentas que sigues aparece en tu lista de seguidores.",
  },
  notFollowingBack: {
    label: CATEGORY_LABELS.notFollowingBack,
    short: "No te siguen",
    description: "Cuentas que sigues, pero que no aparecen entre tus seguidores.",
    icon: UserX,
    tone: "notback",
    emptyTitle: "¡Todos te siguen de vuelta!",
    emptyText: "Todas las cuentas que sigues aparecen también en tu lista de seguidores.",
  },
  followsYouOnly: {
    label: CATEGORY_LABELS.followsYouOnly,
    short: "Te siguen",
    description: "Cuentas que te siguen, pero a las que tú no sigues.",
    icon: UserPlus,
    tone: "youonly",
    emptyTitle: "Sigues a todos tus seguidores",
    emptyText: "No hay nadie que te siga sin que tú le sigas.",
  },
};

/** Fecha relevante para ordenar según la categoría. */
export function relevantDate(category: CategoryKey, a: ComparedAccount): string | undefined {
  if (category === "followsYouOnly") return a.followerSince;
  if (category === "notFollowingBack") return a.followingSince;
  return a.followingSince ?? a.followerSince;
}
