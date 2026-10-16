import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultsView } from "@/components/results/results-view";

export const metadata: Metadata = { title: "Resultados" };

export default function AnalysisPage() {
  return (
    <Suspense>
      <ResultsView />
    </Suspense>
  );
}
