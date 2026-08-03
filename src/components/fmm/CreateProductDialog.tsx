import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import {
  EngineError,
  createProduct,
  type NewProductInput,
  type Product,
} from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Segmented } from "./Segmented";

type ChargeRow = { id: string; label: string; kind: "pct" | "flat"; value: string; agentOnly: boolean };

let chargeRowSeq = 0;
const newChargeRow = (): ChargeRow => ({
  id: `charge-${++chargeRowSeq}`,
  label: "",
  kind: "pct",
  value: "",
  agentOnly: false,
});

export function CreateProductDialog({
  open,
  onOpenChange,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onCreated: (productId: string) => void;
}) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"scratch" | "inherit">("inherit");
  const [inheritFrom, setInheritFrom] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [portfolio, setPortfolio] = useState("");
  const [dasRate, setDasRate] = useState("");
  const [defaultRate, setDefaultRate] = useState("");
  const [interestMode, setInterestMode] = useState<"input" | "fixed">("input");
  const [fixedRate, setFixedRate] = useState("");
  const [charges, setCharges] = useState<ChargeRow[]>(() => [newChargeRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setMode("inherit");
    setInheritFrom("");
    setName("");
    setCurrency("USD");
    setPortfolio("");
    setDasRate("");
    setDefaultRate("");
    setInterestMode("input");
    setFixedRate("");
    setCharges([newChargeRow()]);
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: (body: NewProductInput) => createProduct(body),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      reset();
      if (product.id) onCreated(product.id);
    },
    onError: (err) =>
      setFormError(err instanceof EngineError ? err.message : "Could not create the product."),
  });

  const submit = () => {
    setFormError(null);
    if (!name.trim()) return setFormError("Enter a product name.");
    if (mode === "inherit" && !inheritFrom) return setFormError("Choose a product to inherit from.");
    if (mode === "scratch" && !currency.trim()) return setFormError("Enter a currency.");
    if (mode === "scratch" && !portfolio.trim()) return setFormError("Enter a portfolio.");
    if (mode === "scratch" && interestMode === "fixed" && !fixedRate.trim()) {
      return setFormError("Enter the fixed monthly rate.");
    }

    const body: NewProductInput = { name: name.trim() };
    if (mode === "inherit") {
      body.inherit_from = inheritFrom;
      if (dasRate.trim()) body.das_commission_rate = Number(dasRate) / 100;
      if (defaultRate.trim()) body.interest = { default_rate: Number(defaultRate) / 100 };
    } else {
      body.currency = currency.trim().toUpperCase();
      body.portfolio = portfolio.trim().toUpperCase();
      body.das_commission_rate = dasRate.trim() ? Number(dasRate) / 100 : 0;
      body.das_method = "grossup";
      body.charge_base = "loan_amount";
      body.topup_model = "additive";
      body.pmt_base = "gross_on_contract";
      body.interest =
        interestMode === "fixed"
          ? { mode: "fixed", value: Number(fixedRate) / 100 }
          : { mode: "input", default_rate: defaultRate.trim() ? Number(defaultRate) / 100 : null };
      body.charges = [
        ...charges
          .filter((c) => c.label.trim() && c.value.trim())
          .map((c) => ({
            key: c.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            label: c.label.trim().toUpperCase(),
            kind: c.kind,
            rate: c.kind === "pct" ? Number(c.value) / 100 : null,
            amount: c.kind === "flat" ? Number(c.value) : null,
            base: "loan_amount",
            origin_gate: c.agentOnly ? "AGENT" : null,
            include_in_total: true,
          })),
        { key: "insurance", label: "INSURANCE", kind: "insurance" as const, base: "loan_amount" },
      ];
    }

    mutation.mutate(body);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Build a new calculator from scratch, or inherit everything from an existing product
            and override just what's different.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Segmented
            name="createMode"
            label="Creation mode"
            value={mode}
            options={[
              { value: "inherit", label: "Inherit from existing" },
              { value: "scratch", label: "Build from scratch" },
            ]}
            onChange={(v) => setMode(v as "scratch" | "inherit")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="np-name" className="text-xs font-semibold uppercase tracking-wide">
              Product name*
            </Label>
            <Input
              id="np-name"
              value={name}
              placeholder="e.g. Presidential Office Loan (ZWG)"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {mode === "inherit" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="np-inherit" className="text-xs font-semibold uppercase tracking-wide">
                  Inherit from*
                </Label>
                <Select value={inheritFrom} onValueChange={setInheritFrom}>
                  <SelectTrigger id="np-inherit">
                    <SelectValue placeholder="Select a base product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Currency, charges, interest rule and everything else carries over. Override only
                  what needs to change below.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="np-das" className="text-xs font-semibold uppercase tracking-wide">
                    D.A.S commission (%, optional override)
                  </Label>
                  <Input
                    id="np-das"
                    type="number"
                    min={0}
                    step="0.01"
                    value={dasRate}
                    placeholder="Same as base"
                    onChange={(e) => setDasRate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-rate" className="text-xs font-semibold uppercase tracking-wide">
                    Default rate (%, optional override)
                  </Label>
                  <Input
                    id="np-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={defaultRate}
                    placeholder="Same as base"
                    onChange={(e) => setDefaultRate(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="np-currency" className="text-xs font-semibold uppercase tracking-wide">
                    Currency*
                  </Label>
                  <Input
                    id="np-currency"
                    value={currency}
                    placeholder="USD"
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-portfolio" className="text-xs font-semibold uppercase tracking-wide">
                    Portfolio*
                  </Label>
                  <Input
                    id="np-portfolio"
                    value={portfolio}
                    placeholder="e.g. SME"
                    onChange={(e) => setPortfolio(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide">Interest rate</span>
                <Segmented
                  name="np-interest-mode"
                  label="Interest rate mode"
                  value={interestMode}
                  options={[
                    { value: "input", label: "Entered per quote" },
                    { value: "fixed", label: "Fixed by product" },
                  ]}
                  onChange={(v) => setInterestMode(v as "input" | "fixed")}
                />
              </div>

              {interestMode === "fixed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="np-fixed-rate" className="text-xs font-semibold uppercase tracking-wide">
                    Fixed monthly rate (%)*
                  </Label>
                  <Input
                    id="np-fixed-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={fixedRate}
                    onChange={(e) => setFixedRate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="np-default-rate" className="text-xs font-semibold uppercase tracking-wide">
                    Default rate shown to staff (%, optional)
                  </Label>
                  <Input
                    id="np-default-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="np-das2" className="text-xs font-semibold uppercase tracking-wide">
                  D.A.S commission (%)
                </Label>
                <Input
                  id="np-das2"
                  type="number"
                  min={0}
                  step="0.01"
                  value={dasRate}
                  placeholder="0"
                  onChange={(e) => setDasRate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Charges (insurance is added automatically)
                </span>
                {charges.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <Input
                      value={row.label}
                      placeholder="e.g. Establishment fee"
                      className="flex-1"
                      onChange={(e) =>
                        setCharges((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                        )
                      }
                    />
                    <Select
                      value={row.kind}
                      onValueChange={(v) =>
                        setCharges((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, kind: v as "pct" | "flat" } : r)),
                        )
                      }
                    >
                      <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pct">% of loan</SelectItem>
                        <SelectItem value="flat">Flat fee</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.value}
                      placeholder={row.kind === "pct" ? "%" : "amount"}
                      className="w-24 shrink-0 tabular"
                      onChange={(e) =>
                        setCharges((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Remove charge"
                      onClick={() => setCharges((prev) => prev.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCharges((prev) => [...prev, newChargeRow()])}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add charge
                </Button>
              </div>
            </>
          )}

          {formError ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
