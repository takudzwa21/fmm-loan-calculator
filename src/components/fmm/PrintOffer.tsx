import fmmLogo from "@/assets/fmm-logo.png";
import type { QuoteResponse } from "@/lib/engine";
import { longDate, money, pct, pctFromFraction } from "@/lib/format";

export function PrintOffer({
  quote,
  clientName,
  officer,
  applicationDate,
  quoteRef,
  productVersion,
}: {
  quote: QuoteResponse;
  clientName: string;
  officer: string;
  applicationDate: string;
  quoteRef: string;
  productVersion: string;
}) {
  const c = quote.currency;
  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-3 border-b border-black/15 py-0.5">
      <span>{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );

  const rows = quote.amortisation ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      instalment: acc.instalment + r.instalment,
      interest: acc.interest + r.interest,
      principal: acc.principal + r.principal,
    }),
    { instalment: 0, interest: 0, principal: 0 },
  );

  return (
    <section className="print-only print-sheet text-[9.5pt] leading-snug" aria-hidden="true">
      <div className="mb-1.5 flex items-start justify-between gap-4 border-b-2 border-black pb-1">
        <img src={fmmLogo} alt="First Mutual" className="h-9 w-auto object-contain" />
        <div className="text-right">
          <h1 className="text-base font-bold">Indicative Loan Offer</h1>
          <p className="text-xs">
            Quote reference {quoteRef} · Issued {longDate(applicationDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <h2 className="mt-1 mb-0.5 text-xs font-bold uppercase">Client</h2>
          {line("Client name", clientName?.trim() || "Unnamed client")}
          {line("Loan officer / branch", officer || "—")}

          <h2 className="mt-2 mb-0.5 text-xs font-bold uppercase">Loan</h2>
          {line("Product", `${quote.product_name}${productVersion ? ` (${productVersion})` : ""}`)}
          {line("Currency", c)}
          {line("Loan type", quote.loan_type)}
          {line("Origination / channel", `${quote.origin} / ${quote.channel}`)}
          {line("Gross loan on contract", money(quote.gross_loan_on_contract, c))}
          {line("Tenor", `${quote.tenor} months`)}
          {line("Interest rate (monthly)", pctFromFraction(quote.interest_rate))}
        </div>

        <div>
          <h2 className="mt-1 mb-0.5 text-xs font-bold uppercase">Charges</h2>
          {Object.entries(quote.charges ?? {}).map(([k, v]) => (
            <div key={k}>{line(k, money(v, c))}</div>
          ))}
          {line("Total charges", money(quote.total_charges, c))}

          <h2 className="mt-2 mb-0.5 text-xs font-bold uppercase">Repayment</h2>
          {line("Net amount disbursed", money(quote.net_loan, c))}
          {line("Monthly instalment", money(quote.total_instalment, c))}
          {line("Total repayable", money(quote.total_repayable, c))}
          {line("Effective APR", pct(quote.effective_apr))}
          {line(
            "Instalments",
            `${longDate(quote.expected_instalment_start)} → ${longDate(quote.expected_instalment_end)}`,
          )}
        </div>
      </div>

      <h2 className="mt-2 mb-0.5 text-xs font-bold uppercase">Amortisation schedule</h2>
      <table className="w-full border-collapse text-[9pt]">
        <thead>
          <tr className="border-b-2 border-black text-left uppercase">
            <th className="py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 text-right font-semibold">Opening</th>
            <th className="py-1 pr-2 text-right font-semibold">Instalment</th>
            <th className="py-1 pr-2 text-right font-semibold">Interest</th>
            <th className="py-1 pr-2 text-right font-semibold">Principal</th>
            <th className="py-1 text-right font-semibold">Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period} className="border-b border-black/10">
              <td className="py-0.5 pr-2 tabular">{r.period}</td>
              <td className="py-0.5 pr-2 text-right tabular">{money(r.opening_balance)}</td>
              <td className="py-0.5 pr-2 text-right tabular">{money(r.instalment)}</td>
              <td className="py-0.5 pr-2 text-right tabular">{money(r.interest)}</td>
              <td className="py-0.5 pr-2 text-right tabular">{money(r.principal)}</td>
              <td className="py-0.5 text-right tabular">{money(r.closing_balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1 pr-2">Total</td>
            <td className="py-1 pr-2" />
            <td className="py-1 pr-2 text-right tabular">{money(totals.instalment)}</td>
            <td className="py-1 pr-2 text-right tabular">{money(totals.interest)}</td>
            <td className="py-1 pr-2 text-right tabular">{money(totals.principal)}</td>
            <td className="py-1" />
          </tr>
        </tbody>
      </table>

      <p className="mt-1.5 border-t border-black pt-1 text-xs font-semibold">
        Indicative only, subject to credit approval and affordability checks.
        <span className="ml-2 font-normal">First Mutual Microfinance (Pvt) Ltd. Internal use only.</span>
      </p>
    </section>
  );
}
