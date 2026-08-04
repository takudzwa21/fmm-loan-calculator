import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, UserPlus, Calculator as CalcIcon } from "lucide-react";
import {
  EngineError,
  fetchProduct,
  fetchProducts,
  postQuote,
  type QuoteResponse,
} from "@/lib/engine";
import { compactStamp, todayISO } from "@/lib/format";
import { downloadAmortisationSchedulePdf, downloadQuotePdf } from "@/lib/pdf";
import { downloadAmortisationScheduleWorkbook, downloadQuoteWorkbook } from "@/lib/excel";
import {
  hasData,
  initialFormState,
  toNumber,
  validate,
  type FieldErrors,
  type LoanFormState,
} from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoanForm } from "./LoanForm";
import { ResultsPanel } from "./ResultsPanel";
import { AmortisationSection } from "./AmortisationSection";
import { PrintOffer } from "./PrintOffer";
import { CreateProductDialog } from "./CreateProductDialog";
import { EditProductDialog } from "./EditProductDialog";

export function Calculator() {
  const [form, setForm] = useState<LoanFormState>(initialFormState);
  const [touched, setTouched] = useState<Partial<Record<keyof LoanFormState, boolean>>>({});
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);

  const setField = <K extends keyof LoanFormState>(key: K, value: LoanFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const markTouched = (key: keyof LoanFormState) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    retry: 0,
  });

  const products = productsQuery.data ?? [];

  useEffect(() => {
    if (!form.productId && products.length === 1) setField("productId", products[0]!.id);
  }, [products.length, form.productId]);

  const configQuery = useQuery({
    queryKey: ["product", form.productId],
    queryFn: () => fetchProduct(form.productId),
    enabled: !!form.productId,
    retry: 0,
  });

  const interestMode = configQuery.data?.interest?.mode;
  const rateVisible = interestMode === "input";
  const rateNote =
    interestMode && interestMode !== "input" ? "Rate fixed by product." : null;

  const defaultRatePrefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!form.productId || !configQuery.data) return;
    if (defaultRatePrefilledFor.current === form.productId) return;
    defaultRatePrefilledFor.current = form.productId;
    const defaultRate = configQuery.data.interest?.default_rate;
    if (configQuery.data.interest?.mode === "input" && defaultRate != null) {
      setField("interestRate", String(Math.round(defaultRate * 10000) / 100));
    }
  }, [form.productId, configQuery.data]);

  const errors: FieldErrors = useMemo(() => validate(form, rateVisible), [form, rateVisible]);
  const canSubmit = Object.keys(errors).length === 0;

  const selectedProduct = products.find((p) => p.id === form.productId);
  const productVersion = selectedProduct?.version ?? "";
  const quoteRef = `FMM-${compactStamp(form.applicationDate)}-${(form.productId || "QUOTE").slice(0, 8)}`;

  const mutation = useMutation({
    mutationFn: () =>
      postQuote({
        payload: {
          product_id: form.productId,
          loan_amount: toNumber(form.loanAmount),
          tenor: toNumber(form.tenor),
          origin: form.origin,
          channel: form.channel,
          loan_type: form.loanType,
          interest_rate: rateVisible ? toNumber(form.interestRate) / 100 : 0,
          interest_method: form.interestMethod,
          application_date: form.applicationDate || todayISO(),
          original_loan: toNumber(form.originalLoan),
          old_tenor: toNumber(form.oldTenor),
          current_balance: toNumber(form.currentBalance),
          instalments_paid: toNumber(form.instalmentsPaid),
        },
        fx_rate: form.fxEnabled ? toNumber(form.fxRate) : null,
        fx_currency: form.fxEnabled ? form.fxCurrency || null : null,
        client: { full_name: form.clientName, officer: form.officer },
        quote_ref: quoteRef,
      }),
    onMutate: () => setErrorMsg(null),
    onSuccess: (data) => setQuote(data),
    onError: (err) =>
      setErrorMsg(err instanceof EngineError ? err.message : "Unexpected error. Please try again."),
  });

  const submit = () => {
    setTouched({
      productId: true,
      loanAmount: true,
      tenor: true,
      interestRate: true,
      applicationDate: true,
      fxCurrency: true,
      fxRate: true,
      currentBalance: true,
    });
    if (!canSubmit) return;
    mutation.mutate();
  };

  const doReset = () => {
    setForm(initialFormState());
    setTouched({});
    setQuote(null);
    setErrorMsg(null);
    setConfirmReset(false);
    defaultRatePrefilledFor.current = null;
  };

  const handleReset = () => {
    if (hasData(form) || quote) setConfirmReset(true);
    else doReset();
  };

  const reportMeta = () => ({
    clientName: form.clientName,
    officer: form.officer,
    productVersion,
    applicationDate: form.applicationDate,
    quoteRef,
  });

  const exportQuotePdf = () => {
    if (!quote) return;
    downloadQuotePdf(quote, reportMeta());
  };
  const exportQuoteExcel = () => {
    if (!quote) return;
    downloadQuoteWorkbook(quote, reportMeta());
  };
  const exportSchedulePdf = () => {
    if (!quote) return;
    downloadAmortisationSchedulePdf(quote, reportMeta());
  };
  const exportScheduleExcel = () => {
    if (!quote) return;
    downloadAmortisationScheduleWorkbook(quote, reportMeta());
  };

  return (
    <>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(340px,420px)_1fr]">
        <div className="no-print">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Loan charges calculator</h1>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <UserPlus className="size-4" aria-hidden="true" />
              New client
            </Button>
          </div>

          {productsQuery.isError ? (
            <Card className="mb-3 border-destructive/40 bg-destructive-surface">
              <CardContent className="flex gap-2 pt-6 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-destructive">
                    {productsQuery.error instanceof EngineError &&
                    productsQuery.error.kind === "unconfigured"
                      ? "Calculation engine not configured"
                      : "Cannot reach the calculation engine"}
                  </p>
                  <p className="mt-1 text-foreground">
                    {(productsQuery.error as Error).message}
                  </p>
                  {productsQuery.error instanceof EngineError &&
                  productsQuery.error.kind === "unconfigured" ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => productsQuery.refetch()}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <LoanForm
            form={form}
            setField={setField}
            errors={errors}
            touched={touched}
            markTouched={markTouched}
            products={products}
            productsLoading={productsQuery.isLoading}
            productsError={productsQuery.isError ? (productsQuery.error as Error).message : undefined}
            selectedProduct={selectedProduct}
            rateVisible={rateVisible}
            rateNote={rateNote}
            submitting={mutation.isPending}
            canSubmit={canSubmit}
            onSubmit={submit}
            onReset={handleReset}
            onNewProduct={() => setNewProductOpen(true)}
            onEditProduct={() => setEditProductId(form.productId)}
          />
        </div>

        <div>
          <div aria-live="polite" aria-atomic="true" className="space-y-4">
            {errorMsg ? (
              <Card className="no-print border-destructive/40 bg-destructive-surface">
                <CardContent className="flex gap-2 pt-6 text-sm">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-destructive">Calculation not completed</p>
                    <p className="mt-1 text-foreground">{errorMsg}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your entries have been kept. Adjust and calculate again.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {mutation.isPending ? (
              <Card className="no-print">
                <CardContent className="space-y-3 pt-6">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Calculating charges…
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            ) : quote ? (
              <ResultsPanel
                quote={quote}
                onPrint={() => window.print()}
                onExportPdf={exportQuotePdf}
                onExportExcel={exportQuoteExcel}
              />
            ) : (
              <Card className="no-print border-dashed">
                <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                  <CalcIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium">Enter loan details and press Calculate</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    All figures are indicative and produced by the FMM Loan Charges Engine, subject
                    to credit approval.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {quote && !mutation.isPending ? (
            <div className="mt-4">
              <AmortisationSection
                quote={quote}
                onExportPdf={exportSchedulePdf}
                onExportExcel={exportScheduleExcel}
              />
            </div>
          ) : null}
        </div>
      </div>

      {quote ? (
        <PrintOffer
          quote={quote}
          clientName={form.clientName}
          officer={form.officer}
          applicationDate={form.applicationDate}
          quoteRef={quoteRef}
          productVersion={productVersion}
        />
      ) : null}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the form?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears all captured client and loan details and the current result. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my entries</AlertDialogCancel>
            <AlertDialogAction onClick={doReset}>Clear form</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProductDialog
        open={newProductOpen}
        onOpenChange={setNewProductOpen}
        products={products}
        onCreated={(id) => {
          defaultRatePrefilledFor.current = null;
          setField("productId", id);
        }}
      />

      <EditProductDialog
        productId={editProductId}
        onOpenChange={(o) => !o && setEditProductId(null)}
        onSaved={() => setEditProductId(null)}
      />
    </>
  );
}
