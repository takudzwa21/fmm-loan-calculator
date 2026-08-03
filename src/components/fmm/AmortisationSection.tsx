import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { QuoteResponse } from "@/lib/engine";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadMenu } from "./DownloadMenu";

export function AmortisationSection({
  quote,
  onExportPdf,
  onExportExcel,
}: {
  quote: QuoteResponse;
  onExportPdf: () => void;
  onExportExcel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = quote.amortisation ?? [];

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          instalment: acc.instalment + r.instalment,
          interest: acc.interest + r.interest,
          principal: acc.principal + r.principal,
        }),
        { instalment: 0, interest: 0, principal: 0 },
      ),
    [rows],
  );

  const c = quote.currency;

  return (
    <Card className="no-print">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Amortisation schedule
            <span className="ml-2 font-normal normal-case text-muted-foreground">
              {rows.length} periods
            </span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="amort-table"
            >
              {open ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
              {open ? "Hide schedule" : "Show schedule"}
            </Button>
            <DownloadMenu
              label="Download schedule"
              onDownloadPdf={onExportPdf}
              onDownloadExcel={onExportExcel}
            />
          </div>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <div id="amort-table" className="max-h-[520px] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b-2 border-primary text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Opening balance
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Instalment
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Interest
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Principal
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Closing balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period} className="border-b last:border-0 odd:bg-muted/40">
                    <td className="px-3 py-1.5 tabular">{r.period}</td>
                    <td className="px-3 py-1.5 text-right tabular">{money(r.opening_balance)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{money(r.instalment)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{money(r.interest)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{money(r.principal)}</td>
                    <td className="px-3 py-1.5 text-right tabular">{money(r.closing_balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary bg-card font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular">{money(totals.instalment, c)}</td>
                  <td className="px-3 py-2 text-right tabular">{money(totals.interest, c)}</td>
                  <td className="px-3 py-2 text-right tabular">{money(totals.principal, c)}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
