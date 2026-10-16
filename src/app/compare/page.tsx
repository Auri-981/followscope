import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/history/compare-view";

export const metadata: Metadata = { title: "Comparar análisis" };

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
