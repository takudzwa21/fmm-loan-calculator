import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuoteResponse } from "./engine";
import { FMM_LOGO_BASE64 } from "@/assets/fmm-logo-base64";
import { longDate, money, pct, pctFromFraction, slug } from "./format";

export type ReportMeta = {
  clientName: string;
  officer: string;
  productVersion: string;
  applicationDate: string;
  quoteRef: string;
};

const BRAND_RED: [number, number, number] = [200, 16, 46];
const TEXT_DARK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [107, 114, 128];
const BORDER: [number, number, number] = [229, 231, 235];

const LOGO_ASPECT = 324 / 104;
const PAGE_MARGIN = 14;

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

/** Draws the branded letterhead (logo, title, quote ref) and returns the Y position to start content at. */
function addLetterhead(doc: jsPDF, title: string, meta: ReportMeta): number {
  const w = pageWidth(doc);
  const logoH = 11;
  const logoW = logoH * LOGO_ASPECT;
  doc.addImage(FMM_LOGO_BASE64, "PNG", PAGE_MARGIN, 10, logoW, logoH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, w - PAGE_MARGIN, 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Quote ref: ${meta.quoteRef}`, w - PAGE_MARGIN, 20.5, { align: "right" });
  doc.text(`Date: ${longDate(meta.applicationDate)}`, w - PAGE_MARGIN, 25, { align: "right" });

  doc.setDrawColor(...BRAND_RED);
  doc.setLineWidth(0.8);
  doc.line(PAGE_MARGIN, 28, w - PAGE_MARGIN, 28);

  return 36;
}

/** Adds the footer (disclaimer, contact details, page number) to every page already drawn. */
function addFooterToAllPages(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const w = pageWidth(doc);
  const h = pageHeight(doc);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(PAGE_MARGIN, h - 18, w - PAGE_MARGIN, h - 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "First Mutual Microfinance (Pvt) Ltd. Internal use only. Indicative only, subject to credit approval and affordability checks.",
      PAGE_MARGIN,
      h - 11,
    );
    doc.text(`Page ${i} of ${pageCount}`, w - PAGE_MARGIN, h - 11, { align: "right" });
  }
}

/** Client / loan summary block shared by both report types. Returns the next free Y. */
function addSummaryBlock(
  doc: jsPDF,
  quote: QuoteResponse,
  meta: ReportMeta,
  startY: number,
): number {
  const w = pageWidth(doc);
  const colW = (w - PAGE_MARGIN * 2) / 2;
  let y = startY;

  const left: [string, string][] = [
    ["Client", meta.clientName?.trim() || "Unnamed client"],
    ["Loan officer / branch", meta.officer || "—"],
    ["Product", `${quote.product_name}${meta.productVersion ? ` (${meta.productVersion})` : ""}`],
    ["Loan type", `${quote.loan_type} · ${quote.origin} / ${quote.channel}`],
  ];
  const right: [string, string][] = [
    ["Currency", quote.currency],
    ["Tenor", `${quote.tenor} months`],
    ["Interest rate (monthly)", pctFromFraction(quote.interest_rate)],
    [
      "Instalment window",
      `${longDate(quote.expected_instalment_start)} — ${longDate(quote.expected_instalment_end)}`,
    ],
  ];

  doc.setFontSize(9);
  const rowH = 9;
  left.forEach(([label, value], i) => {
    const ly = y + i * rowH;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(label, PAGE_MARGIN, ly);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(value, PAGE_MARGIN, ly + 4);
  });
  right.forEach(([label, value], i) => {
    const ly = y + i * rowH;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(label, PAGE_MARGIN + colW, ly);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(value, PAGE_MARGIN + colW, ly + 4);
  });

  y += left.length * rowH + 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, y, w - PAGE_MARGIN, y);
  return y + 7;
}

function amortisationTable(doc: jsPDF, quote: QuoteResponse, startY: number): number {
  const rows = quote.amortisation ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      instalment: acc.instalment + r.instalment,
      interest: acc.interest + r.interest,
      principal: acc.principal + r.principal,
    }),
    { instalment: 0, interest: 0, principal: 0 },
  );

  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 24 },
    head: [["#", "Opening balance", "Instalment", "Interest", "Principal", "Closing balance"]],
    body: rows.map((r) => [
      String(r.period),
      money(r.opening_balance),
      money(r.instalment),
      money(r.interest),
      money(r.principal),
      money(r.closing_balance),
    ]),
    foot: [
      [
        "Total",
        "",
        money(totals.instalment),
        money(totals.interest),
        money(totals.principal),
        "",
      ],
    ],
    showFoot: "lastPage",
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2, textColor: TEXT_DARK, lineColor: BORDER },
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 246], textColor: TEXT_DARK, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left", cellWidth: 12 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export function downloadAmortisationSchedulePdf(quote: QuoteResponse, meta: ReportMeta): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = addLetterhead(doc, "Amortisation Schedule", meta);
  y = addSummaryBlock(doc, quote, meta, y);
  amortisationTable(doc, quote, y);
  addFooterToAllPages(doc);

  const client = meta.clientName?.trim() || "client";
  doc.save(`FMM_Amortisation_Schedule_${slug(client)}_${meta.quoteRef}.pdf`);
}

export function downloadQuotePdf(quote: QuoteResponse, meta: ReportMeta): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const c = quote.currency;
  let y = addLetterhead(doc, "Indicative Loan Offer", meta);
  y = addSummaryBlock(doc, quote, meta, y);

  const chargeRows = Object.entries(quote.charges ?? {}).map(([label, amount]) => [
    label,
    money(amount, c),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["Charges", `Amount (${c})`]],
    body: chargeRows,
    foot: [["Total charges", money(quote.total_charges, c)]],
    showFoot: "lastPage",
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2.4, textColor: TEXT_DARK, lineColor: BORDER },
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 246], textColor: TEXT_DARK, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  const repayment: [string, string][] = [
    ["Net amount disbursed", money(quote.net_loan, c)],
    ["Monthly instalment", money(quote.total_instalment, c)],
    ["Total repayable", money(quote.total_repayable, c)],
    ["Total interest", money(quote.total_interest, c)],
    ["Total cost of credit", money(quote.total_cost_of_credit, c)],
    ["Effective APR", pct(quote.effective_apr)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    body: repayment,
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.6, textColor: TEXT_DARK },
    columnStyles: {
      0: { textColor: MUTED, cellWidth: 70 },
      1: { halign: "right", fontStyle: "bold" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  if (y > pageHeight(doc) - 60) {
    doc.addPage();
    y = 16;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Amortisation schedule", PAGE_MARGIN, y);
  y += 5;

  amortisationTable(doc, quote, y);
  addFooterToAllPages(doc);

  const client = meta.clientName?.trim() || "client";
  doc.save(`FMM_Loan_Quote_${slug(client)}_${meta.quoteRef}.pdf`);
}
