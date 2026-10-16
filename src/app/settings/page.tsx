import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Ajustes y privacidad" };

export default function SettingsPage() {
  return <SettingsView />;
}
