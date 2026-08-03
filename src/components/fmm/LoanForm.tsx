import {
  AlertCircle,
  Loader2,
  RotateCcw,
  Calculator as CalcIcon,
  Info,
  Pencil,
  Plus,
} from "lucide-react";
import type { LoanFormState, FieldErrors } from "@/lib/form";
import type { Product } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Segmented } from "./Segmented";

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function Field({
  id,
  label,
  required,
  help,
  error,
  labelClassName,
  children,
}: {
  id: string;
  label: string;
  required?: boolean | undefined;
  help?: string | undefined;
  error?: string | undefined;
  labelClassName?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className={`block text-xs font-semibold uppercase leading-4 tracking-wide ${labelClassName ?? ""}`}
      >
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function LoanForm({
  form,
  setField,
  errors,
  touched,
  markTouched,
  products,
  productsLoading,
  productsError,
  selectedProduct,
  rateVisible,
  rateNote,
  submitting,
  canSubmit,
  onSubmit,
  onReset,
  onNewProduct,
  onEditProduct,
}: {
  form: LoanFormState;
  setField: <K extends keyof LoanFormState>(key: K, value: LoanFormState[K]) => void;
  errors: FieldErrors;
  touched: Partial<Record<keyof LoanFormState, boolean>>;
  markTouched: (key: keyof LoanFormState) => void;
  products: Product[];
  productsLoading: boolean;
  productsError?: string | undefined;
  selectedProduct?: Product | undefined;
  rateVisible: boolean;
  rateNote: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onNewProduct: () => void;
  onEditProduct: () => void;
}) {
  const err = (k: keyof LoanFormState) => (touched[k] ? errors[k] : undefined);
  const currency = selectedProduct?.currency ?? "";
  const tenorWarning = Number(form.tenor) > 84;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Client details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field id="clientName" label="Client name" help="Used on the printed indicative offer.">
            <Input
              id="clientName"
              value={form.clientName}
              placeholder="e.g. Eng. Taku"
              aria-describedby="clientName-help"
              onChange={(e) => setField("clientName", e.target.value)}
            />
          </Field>
          <Field id="officer" label="Loan officer / branch">
            <Input
              id="officer"
              value={form.officer}
              placeholder="Melinda Muredzi"
              onChange={(e) => setField("officer", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Loan request
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="productId" className="text-xs font-semibold uppercase tracking-wide">
                Calculator / product<span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="flex items-center gap-1">
                {form.productId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onEditProduct}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onNewProduct}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  New product
                </Button>
              </div>
            </div>
            {productsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={form.productId}
                onValueChange={(v) => {
                  setField("productId", v);
                  markTouched("productId");
                }}
              >
                <SelectTrigger
                  id="productId"
                  aria-invalid={!!err("productId")}
                  onBlur={() => markTouched("productId")}
                >
                  <SelectValue placeholder="Select a calculator" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                          {p.currency}
                        </span>
                        {p.custom ? (
                          <span className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                            CUSTOM
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError id="productId-error" message={err("productId") ?? productsError} />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide">Loan type</span>
            <Segmented
              name="loanType"
              label="Loan type"
              value={form.loanType}
              options={[
                { value: "NEW", label: "NEW" },
                { value: "TOP-UP", label: "TOP-UP" },
              ]}
              onChange={(v) => setField("loanType", v as LoanFormState["loanType"])}
            />
          </div>

          <Field
            id="loanAmount"
            label={form.loanType === "TOP-UP" ? "Top-up amount" : "Loan amount"}
            required
            error={err("loanAmount")}
          >
            <div className="flex">
              <span className="inline-flex min-w-12 items-center justify-center rounded-l-md border border-r-0 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                {currency || "CUR"}
              </span>
              <Input
                id="loanAmount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="rounded-l-none tabular"
                value={form.loanAmount}
                aria-invalid={!!err("loanAmount")}
                aria-describedby={err("loanAmount") ? "loanAmount-error" : undefined}
                onChange={(e) => setField("loanAmount", e.target.value)}
                onBlur={() => markTouched("loanAmount")}
              />
            </div>
          </Field>

          <Field id="tenor" label="Tenor (months)" required error={err("tenor")}>
            <Input
              id="tenor"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="tabular"
              value={form.tenor}
              aria-invalid={!!err("tenor")}
              aria-describedby={err("tenor") ? "tenor-error" : undefined}
              onChange={(e) => setField("tenor", e.target.value)}
              onBlur={() => markTouched("tenor")}
            />
            {tenorWarning ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded border border-warning/40 bg-warning-surface px-2 py-1 text-xs font-medium text-warning">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                Beyond the insurance table, rate extrapolated.
              </p>
            ) : null}
          </Field>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide">Loan origination</span>
            <Segmented
              name="origin"
              label="Loan origination"
              value={form.origin}
              options={[
                { value: "BRANCH", label: "BRANCH" },
                { value: "AGENT", label: "AGENT" },
              ]}
              onChange={(v) => setField("origin", v as LoanFormState["origin"])}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Disbursement channel
            </span>
            <Segmented
              name="channel"
              label="Disbursement channel"
              value={form.channel}
              options={[
                { value: "BANK", label: "BANK" },
                { value: "ECOCASH", label: "ECOCASH" },
              ]}
              onChange={(v) => setField("channel", v as LoanFormState["channel"])}
            />
          </div>

          {rateVisible ? (
            <Field
              id="interestRate"
              label="Interest rate (monthly)"
              required
              help="Enter as a percentage, e.g. 8 for 8% per month."
              error={err("interestRate")}
            >
              <div className="flex">
                <Input
                  id="interestRate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="rounded-r-none tabular"
                  value={form.interestRate}
                  aria-invalid={!!err("interestRate")}
                  aria-describedby="interestRate-help"
                  onChange={(e) => setField("interestRate", e.target.value)}
                  onBlur={() => markTouched("interestRate")}
                />
                <span className="inline-flex min-w-10 items-center justify-center rounded-r-md border border-l-0 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                  %
                </span>
              </div>
            </Field>
          ) : rateNote ? (
            <p className="flex items-center gap-1.5 rounded border bg-muted px-2.5 py-2 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              {rateNote}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Interest calculation method
            </span>
            <Segmented
              name="interestMethod"
              label="Interest calculation method"
              value={form.interestMethod}
              options={[
                { value: "reducing_balance", label: "Reducing balance" },
                { value: "straight_line", label: "Straight line" },
              ]}
              onChange={(v) =>
                setField("interestMethod", v as LoanFormState["interestMethod"])
              }
            />
            <p className="text-xs text-muted-foreground">
              Reducing balance is the default; straight line charges interest on the original
              amount for the full term.
            </p>
          </div>

          <Field id="applicationDate" label="Application date" required error={err("applicationDate")}>
            <Input
              id="applicationDate"
              type="date"
              className="tabular"
              value={form.applicationDate}
              aria-invalid={!!err("applicationDate")}
              onChange={(e) => setField("applicationDate", e.target.value)}
              onBlur={() => markTouched("applicationDate")}
            />
          </Field>
        </CardContent>
      </Card>

      {form.loanType === "TOP-UP" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Existing loan
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              id="originalLoan"
              label="Original loan amount"
              labelClassName="sm:min-h-8"
            >
              <Input
                id="originalLoan"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={form.originalLoan}
                onChange={(e) => setField("originalLoan", e.target.value)}
              />
            </Field>
            <Field id="oldTenor" label="Original tenor (months)" labelClassName="sm:min-h-8">
              <Input
                id="oldTenor"
                type="number"
                min={0}
                step={1}
                className="tabular"
                value={form.oldTenor}
                onChange={(e) => setField("oldTenor", e.target.value)}
              />
            </Field>
            <Field
              id="currentBalance"
              label="Current outstanding balance"
              labelClassName="sm:min-h-8"
              error={err("currentBalance")}
            >
              <Input
                id="currentBalance"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={form.currentBalance}
                onChange={(e) => setField("currentBalance", e.target.value)}
                onBlur={() => markTouched("currentBalance")}
              />
            </Field>
            <Field
              id="instalmentsPaid"
              label="Instalments already paid"
              labelClassName="sm:min-h-8"
            >
              <Input
                id="instalmentsPaid"
                type="number"
                min={0}
                step={1}
                className="tabular"
                value={form.instalmentsPaid}
                onChange={(e) => setField("instalmentsPaid", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              FX equivalent (optional)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="fxEnabled" className="text-xs text-muted-foreground">
                Show FX
              </Label>
              <Switch
                id="fxEnabled"
                checked={form.fxEnabled}
                onCheckedChange={(v) => setField("fxEnabled", v)}
              />
            </div>
          </div>
        </CardHeader>
        {form.fxEnabled ? (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="fxCurrency" label="Target currency" error={err("fxCurrency")}>
              <Input
                id="fxCurrency"
                value={form.fxCurrency}
                placeholder="ZWG"
                onChange={(e) => setField("fxCurrency", e.target.value.toUpperCase())}
                onBlur={() => markTouched("fxCurrency")}
              />
            </Field>
            <Field id="fxRate" label="Exchange rate" error={err("fxRate")}>
              <Input
                id="fxRate"
                type="number"
                min={0}
                step="0.0001"
                className="tabular"
                value={form.fxRate}
                onChange={(e) => setField("fxRate", e.target.value)}
                onBlur={() => markTouched("fxRate")}
              />
            </Field>
          </CardContent>
        ) : null}
      </Card>

      <div className="sticky bottom-0 flex gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="submit" disabled={submitting || !canSubmit} className="flex-1">
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalcIcon className="size-4" aria-hidden="true" />
          )}
          {submitting ? "Calculating…" : "Calculate"}
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </Button>
      </div>
    </form>
  );
}
