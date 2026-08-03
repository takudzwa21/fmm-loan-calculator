import { createFileRoute } from "@tanstack/react-router";
import { AppBar } from "@/components/fmm/AppBar";
import { Footer } from "@/components/fmm/Footer";
import { HistoryView } from "@/components/fmm/HistoryView";

const title = "Quote history | FMM Loan Charges Calculator";
const description =
  "Search, sort, edit and download past loan quotes calculated with the FMM Loan Charges Engine.";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />
      <main className="flex-1">
        <HistoryView />
      </main>
      <Footer />
    </div>
  );
}
