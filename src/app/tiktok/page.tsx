import type { Metadata } from "next";
import { PlatformWorkspace } from "@/components/platform/platform-workspace";

export const metadata: Metadata = { title: "TikTok" };

export default function TikTokPage() {
  return <PlatformWorkspace platform="tiktok" />;
}
