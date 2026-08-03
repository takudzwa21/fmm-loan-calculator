import { createFileRoute } from "@tanstack/react-router";
import { AppBar } from "@/components/fmm/AppBar";
import { Footer } from "@/components/fmm/Footer";
import { Calculator } from "@/components/fmm/Calculator";

const title = "FMM Loan Charges Calculator | First Mutual Microfinance";
const description =
  "Internal calculator for First Mutual Microfinance loan charges: capture a loan request, view charges, instalments, amortisation and export to PDF.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />
      <main className="flex-1">
        <Calculator />
      </main>
      <Footer />
    </div>
  );
}
