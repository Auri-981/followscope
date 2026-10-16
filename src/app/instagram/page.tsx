import type { Metadata } from "next";
import { PlatformWorkspace } from "@/components/platform/platform-workspace";

export const metadata: Metadata = { title: "Instagram" };

export default function InstagramPage() {
  return <PlatformWorkspace platform="instagram" />;
}
