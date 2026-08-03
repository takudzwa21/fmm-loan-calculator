import * as XLSX from "xlsx";
import type { QuoteResponse } from "./engine";
import { compactStamp, longDate, slug } from "./format";
import type { ReportMeta } from "./pdf";

const NUM_FMT = "#,##0.00";

function applyNumberFormat(ws: XLSX.WorkSheet, cells: string[]) {
  for (const addr of cells) {
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (cell && typeof cell.v === "number") cell.z = NUM_FMT;
  }
}

const INTEREST_METHOD_LABEL: Record<string, string> = {
  reducing_balance: "Reducing balance",
  straight_line: "Straight line",
};

export function downloadQuoteWorkbook(quote: QuoteResponse, meta: ReportMeta) {
  const wb = XLSX.utils.book_new();
  const client = meta.clientName?.trim() || "Unnamed client";

  /* ---------- Summary ---------- */
  const summary: (string | number)[][] = [
    ["First Mutual Microfinance (Pvt) Ltd"],
    ["Loan Charges Calculator - Indicative Quote"],
    [`Quote reference: ${meta.quoteRef}`],
    [`Generated: ${longDate(new Date().toISOString().slice(0, 10))}`],
    [],
    ["Client", client],
    ["Loan officer / branch", meta.officer || "-"],
    ["Application date", longDate(meta.applicationDate)],
    [],
    ["Product", quote.product_name],
    ["Product version", meta.productVersion || "-"],
    ["Currency", quote.currency],
    ["Portfolio", quote.portfolio],
    ["Loan type", quote.loan_type],
    ["Origination", quote.origin],
    ["Disbursement channel", quote.channel],
    ["Loan amount", quote.gross_loan_on_contract],
    ["Tenor (months)", quote.tenor],
    ["Interest rate (monthly %)", Number((quote.interest_rate * 100).toFixed(4))],
    ["Interest calculation method", INTEREST_METHOD_LABEL[quote.interest_method] ?? quote.interest_method],
    [],
    ["Charges", `Amount (${quote.currency})`],
  ];

  const chargeStart = summary.length + 1;
  for (const [label, amount] of Object.entries(quote.charges ?? {})) {
    summary.push([label, amount]);
  }
  summary.push(["Total charges", quote.total_charges]);
  const chargeEnd = summary.length;

  summary.push(
    [],
    ["Gross loan on contract", quote.gross_loan_on_contract],
    ["Gross loan after liquidation", quote.gross_loan_after_liquidation],
    ["Net amount disbursed", quote.net_loan],
    ["Indicative instalment", quote.indicative_instalment],
    ["D.A.S commission", quote.das_commission],
    ["Total instalment", quote.total_instalment],
    ["Total repayable", quote.total_repayable],
    ["Total interest", quote.total_interest],
    ["Total cost of credit", quote.total_cost_of_credit],
    ["Effective APR (%)", Number(quote.effective_apr.toFixed(1))],
    [],
    ["Instalments start", longDate(quote.expected_instalment_start)],
    ["Instalments end", longDate(quote.expected_instalment_end)],
  );

  if (quote.fx) {
    summary.push(
      [],
      [`FX equivalent (${quote.fx.currency})`],
      ["Exchange rate", quote.fx.rate],
      ["Net amount disbursed", quote.fx.net_loan],
      ["Monthly instalment", quote.fx.total_instalment],
      ["Total charges", quote.fx.total_charges],
      ["Total repayable", quote.fx.total_repayable],
      ["Total interest", quote.fx.total_interest],
    );
  }

  summary.push([], ["Indicative only. Subject to credit approval and affordability checks."]);

  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 34 }, { wch: 26 }];
  const moneyRows: string[] = [];
  for (let r = chargeStart; r <= chargeEnd; r++) moneyRows.push(`B${r}`);
  for (let r = chargeEnd + 2; r <= summary.length; r++) moneyRows.push(`B${r}`);
  applyNumberFormat(ws1, moneyRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  /* ---------- Amortisation ---------- */
  const rows: (string | number)[][] = [
    ["First Mutual Microfinance (Pvt) Ltd - Amortisation Schedule"],
    [`Client: ${client}    Product: ${quote.product_name}    Currency: ${quote.currency}`],
    [`Quote reference: ${meta.quoteRef}    Generated: ${longDate(new Date().toISOString().slice(0, 10))}`],
    [],
    ["#", "Opening balance", "Instalment", "Interest", "Principal", "Closing balance"],
  ];

  const headerRow = rows.length;
  const totals = { instalment: 0, interest: 0, principal: 0 };
  for (const r of quote.amortisation ?? []) {
    totals.instalment += r.instalment;
    totals.interest += r.interest;
    totals.principal += r.principal;
    rows.push([
      r.period,
      r.opening_balance,
      r.instalment,
      r.interest,
      r.principal,
      r.closing_balance,
    ]);
  }
  rows.push(["Total", "", totals.instalment, totals.interest, totals.principal, ""]);

  const ws2 = XLSX.utils.aoa_to_sheet(rows);
  ws2["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];
  const fmtCells: string[] = [];
  for (let r = headerRow + 1; r <= rows.length; r++) {
    for (const col of ["B", "C", "D", "E", "F"]) fmtCells.push(`${col}${r}`);
  }
  applyNumberFormat(ws2, fmtCells);
  XLSX.utils.book_append_sheet(wb, ws2, "Amortisation");

  XLSX.writeFile(
    wb,
    `FMM_Loan_Quote_${slug(client)}_${meta.quoteRef}.xlsx`,
  );
}

export function downloadAmortisationScheduleWorkbook(quote: QuoteResponse, meta: ReportMeta) {
  const wb = XLSX.utils.book_new();
  const client = meta.clientName?.trim() || "Unnamed client";

  const rows: (string | number)[][] = [
    ["First Mutual Microfinance (Pvt) Ltd - Amortisation Schedule"],
    [`Client: ${client}    Product: ${quote.product_name}    Currency: ${quote.currency}`],
    [`Quote reference: ${meta.quoteRef}    Generated: ${longDate(new Date().toISOString().slice(0, 10))}`],
    [`Tenor: ${quote.tenor} months    Interest method: ${INTEREST_METHOD_LABEL[quote.interest_method] ?? quote.interest_method}`],
    [],
    ["#", "Opening balance", "Instalment", "Interest", "Principal", "Closing balance"],
  ];

  const headerRow = rows.length;
  const totals = { instalment: 0, interest: 0, principal: 0 };
  for (const r of quote.amortisation ?? []) {
    totals.instalment += r.instalment;
    totals.interest += r.interest;
    totals.principal += r.principal;
    rows.push([
      r.period,
      r.opening_balance,
      r.instalment,
      r.interest,
      r.principal,
      r.closing_balance,
    ]);
  }
  rows.push(["Total", "", totals.instalment, totals.interest, totals.principal, ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  const fmtCells: string[] = [];
  for (let r = headerRow + 1; r <= rows.length; r++) {
    for (const col of ["B", "C", "D", "E", "F"]) fmtCells.push(`${col}${r}`);
  }
  applyNumberFormat(ws, fmtCells);
  XLSX.utils.book_append_sheet(wb, ws, "Amortisation");

  XLSX.writeFile(
    wb,
    `FMM_Amortisation_Schedule_${slug(client)}_${meta.quoteRef}.xlsx`,
  );
}
