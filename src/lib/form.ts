import type { InterestCalculationMethod } from "./engine";
import { todayISO } from "./format";

export type LoanFormState = {
  clientName: string;
  officer: string;
  productId: string;
  loanType: "NEW" | "TOP-UP";
  loanAmount: string;
  tenor: string;
  origin: "BRANCH" | "AGENT";
  channel: "BANK" | "ECOCASH";
  interestRate: string;
  interestMethod: InterestCalculationMethod;
  applicationDate: string;
  originalLoan: string;
  oldTenor: string;
  currentBalance: string;
  instalmentsPaid: string;
  fxEnabled: boolean;
  fxCurrency: string;
  fxRate: string;
};

export const initialFormState = (): LoanFormState => ({
  clientName: "",
  officer: "",
  productId: "",
  loanType: "NEW",
  loanAmount: "",
  tenor: "",
  origin: "BRANCH",
  channel: "BANK",
  interestRate: "",
  interestMethod: "reducing_balance",
  applicationDate: todayISO(),
  originalLoan: "",
  oldTenor: "",
  currentBalance: "",
  instalmentsPaid: "",
  fxEnabled: false,
  fxCurrency: "",
  fxRate: "",
});

export const toNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type FieldErrors = Partial<Record<keyof LoanFormState, string>>;

export function validate(form: LoanFormState, rateVisible: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!form.productId) e.productId = "Select a calculator / product.";
  if (!form.loanAmount.trim() || toNumber(form.loanAmount) <= 0)
    e.loanAmount = "Enter an amount greater than 0.";
  const tenor = toNumber(form.tenor);
  if (!form.tenor.trim() || tenor <= 0 || !Number.isInteger(tenor))
    e.tenor = "Enter a whole number of months greater than 0.";
  if (rateVisible) {
    const rate = toNumber(form.interestRate);
    if (!form.interestRate.trim() || rate <= 0)
      e.interestRate = "Enter the monthly interest rate as a percentage.";
  }
  if (!form.applicationDate) e.applicationDate = "Choose an application date.";
  if (form.loanType === "TOP-UP") {
    if (toNumber(form.currentBalance) < 0)
      e.currentBalance = "Outstanding balance cannot be negative.";
  }
  if (form.fxEnabled) {
    if (!form.fxCurrency.trim()) e.fxCurrency = "Enter the target currency code.";
    if (toNumber(form.fxRate) <= 0) e.fxRate = "Enter an exchange rate greater than 0.";
  }
  return e;
}

export function hasData(form: LoanFormState): boolean {
  const blank = initialFormState();
  return (Object.keys(blank) as (keyof LoanFormState)[]).some(
    (k) => k !== "applicationDate" && form[k] !== blank[k],
  );
}
