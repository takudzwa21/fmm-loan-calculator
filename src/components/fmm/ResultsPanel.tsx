import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Printer, HelpCircle } from "lucide-react";
import type { QuoteResponse } from "@/lib/engine";
import { longDate, money, num, pct, pctFromFraction, titleise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DownloadMenu } from "./DownloadMenu";

const INTEREST_METHOD_LABEL: Record<string, string> = {
  reducing_balance: "Reducing balance",
  straight_line: "Straight line",
};

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b py-1.5 last:border-0 ${
        bold ? "font-semibold" : ""
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm tabular ${bold ? "text-foreground" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function Headline({
  label,
  value,
  emphasis,
  tip,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tip?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {tip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${label}: ${tip}`}
                  className="text-muted-foreground"
                >
                  <HelpCircle className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-60 text-xs">{tip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </p>
      <p
        className={`mt-1.5 tabular font-semibold ${
          emphasis ? "text-2xl text-primary" : "text-xl text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ResultsPanel({
  quote,
  onPrint,
  onExportPdf,
  onExportExcel,
}: {
  quote: QuoteResponse;
  onPrint: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}) {
  const [insOpen, setInsOpen] = useState(false);
  const c = quote.currency;
  const ins = quote.insurance_breakdown ?? null;

  return (
    <div className="no-print space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Indicative result</h2>
          <p className="text-xs text-muted-foreground">
            {quote.product_name} · {quote.portfolio} · {c}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="size-4" aria-hidden="true" />
            Print offer
          </Button>
          <DownloadMenu label="Download quote" onDownloadPdf={onExportPdf} onDownloadExcel={onExportExcel} />
        </div>
      </div>

      {quote.warnings?.length ? (
        <div
          role="status"
          className="flex gap-2 rounded-md border border-warning/40 bg-warning-surface p-3"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-sm text-foreground">
            <p className="font-semibold text-warning">Warnings</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {quote.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Headline label="Net amount disbursed" value={money(quote.net_loan, c)} emphasis />
        <Headline label="Monthly instalment" value={money(quote.total_instalment, c)} />
        <Headline label="Total charges" value={money(quote.total_charges, c)} />
        <Headline
          label="Effective APR"
          value={pct(quote.effective_apr)}
          tip="Annualised effective interest rate implied by the repayments"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Charges breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-1.5 text-left font-semibold">
                    Charge
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    Amount ({c})
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(quote.charges ?? {}).map(([label, amount]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="py-1.5">{label}</td>
                    <td className="py-1.5 text-right tabular">{money(amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary font-semibold">
                  <td className="py-2">Total charges</td>
                  <td className="py-2 text-right tabular">{money(quote.total_charges)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-3">
              <Row label="Gross loan on contract" value={money(quote.gross_loan_on_contract, c)} />
              {quote.gross_loan_after_liquidation !== quote.gross_loan_on_contract ? (
                <Row
                  label="Gross loan after liquidation"
                  value={money(quote.gross_loan_after_liquidation, c)}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Repayment summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Indicative instalment" value={money(quote.indicative_instalment, c)} />
            <Row label="D.A.S commission" value={money(quote.das_commission, c)} />
            <Row label="Total instalment" value={money(quote.total_instalment, c)} bold />
            <Row label="Total repayable" value={money(quote.total_repayable, c)} />
            <Row label="Total interest" value={money(quote.total_interest, c)} />
            <Row label="Total cost of credit" value={money(quote.total_cost_of_credit, c)} />
            <Row label="Interest rate (monthly)" value={pctFromFraction(quote.interest_rate)} />
            <Row
              label="Interest calculation method"
              value={INTEREST_METHOD_LABEL[quote.interest_method] ?? quote.interest_method}
            />
            <Row label="Tenor" value={`${quote.tenor} months`} />
            <Row
              label="Schedule window"
              value={`${longDate(quote.expected_instalment_start)} → ${longDate(
                quote.expected_instalment_end,
              )}`}
            />
          </CardContent>
        </Card>
      </div>

      {ins ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                Insurance breakdown
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInsOpen((o) => !o)}
                aria-expanded={insOpen}
                aria-controls="insurance-detail"
              >
                {insOpen ? (
                  <ChevronUp className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4" aria-hidden="true" />
                )}
                {insOpen ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {insOpen ? (
            <CardContent id="insurance-detail" className="grid gap-x-8 sm:grid-cols-2">
              {Object.entries(ins).map(([k, v]) => (
                <Row
                  key={k}
                  label={k === "upr" ? "UPR" : k === "rate_used" ? "Rate used" : titleise(k)}
                  value={k === "rate_used" ? pctFromFraction(v) : money(v, c)}
                />
              ))}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {quote.fx ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              FX equivalent ({quote.fx.currency})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 sm:grid-cols-2">
            <Row label="Exchange rate" value={`1 ${c} = ${num(quote.fx.rate, 4)} ${quote.fx.currency}`} />
            <Row label="Net amount disbursed" value={money(quote.fx.net_loan, quote.fx.currency)} />
            <Row label="Monthly instalment" value={money(quote.fx.total_instalment, quote.fx.currency)} />
            <Row label="Total charges" value={money(quote.fx.total_charges, quote.fx.currency)} />
            <Row label="Total repayable" value={money(quote.fx.total_repayable, quote.fx.currency)} />
            <Row label="Total interest" value={money(quote.fx.total_interest, quote.fx.currency)} />
            <Row
              label="Total cost of credit"
              value={money(quote.fx.total_cost_of_credit, quote.fx.currency)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
