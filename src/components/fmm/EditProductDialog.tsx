import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  EngineError,
  fetchProduct,
  updateProduct,
  type ProductConfig,
} from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function EditProductDialog({
  productId,
  onOpenChange,
  onSaved,
}: {
  productId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["product-edit", productId],
    queryFn: () => fetchProduct(productId as string),
    enabled: !!productId,
    retry: 0,
  });
  const product = productQuery.data;

  const [name, setName] = useState("");
  const [dasRate, setDasRate] = useState("");
  const [insuranceOverride, setInsuranceOverride] = useState(false);
  const [insuranceRate, setInsuranceRate] = useState("");
  const [agentCommissionRate, setAgentCommissionRate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const agentChargeIndex = (product?.charges ?? []).findIndex((c) => c.key === "agent_commission");

  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setDasRate(String(Math.round((product.das_commission_rate ?? 0) * 10000) / 100));
    const override = product.insurance_rate_override;
    setInsuranceOverride(override != null);
    setInsuranceRate(override != null ? String(Math.round(override * 10000) / 100) : "");
    if (agentChargeIndex >= 0) {
      const rate = product.charges?.[agentChargeIndex]?.rate;
      setAgentCommissionRate(typeof rate === "number" ? String(Math.round(rate * 10000) / 100) : "");
    } else {
      setAgentCommissionRate("");
    }
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const mutation = useMutation({
    mutationFn: (body: ProductConfig) => updateProduct(productId as string, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      onSaved();
    },
    onError: (err) =>
      setFormError(err instanceof EngineError ? err.message : "Could not update this product."),
  });

  const submit = () => {
    setFormError(null);
    if (!name.trim()) return setFormError("Enter a product name.");
    if (!product) return;

    const body: ProductConfig = {
      name: name.trim(),
      das_commission_rate: dasRate.trim() ? Number(dasRate) / 100 : 0,
      insurance_rate_override: insuranceOverride && insuranceRate.trim() ? Number(insuranceRate) / 100 : null,
    };

    if (agentChargeIndex >= 0) {
      const charges = [...(product.charges ?? [])];
      charges[agentChargeIndex] = {
        ...charges[agentChargeIndex]!,
        rate: agentCommissionRate.trim() ? Number(agentCommissionRate) / 100 : 0,
      };
      body.charges = charges;
    }

    mutation.mutate(body);
  };

  return (
    <Dialog open={!!productId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>
            {product ? `${product.name} (${product.currency})` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {productQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : productQuery.isError ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Could not load this product.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-name" className="text-xs font-semibold uppercase tracking-wide">
                Product name*
              </Label>
              <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-das" className="text-xs font-semibold uppercase tracking-wide">
                D.A.S commission (%)
              </Label>
              <Input
                id="ep-das"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={dasRate}
                onChange={(e) => setDasRate(e.target.value)}
              />
            </div>

            {agentChargeIndex >= 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="ep-agent" className="text-xs font-semibold uppercase tracking-wide">
                  Agent commission (%)
                </Label>
                <Input
                  id="ep-agent"
                  type="number"
                  min={0}
                  step="0.01"
                  className="tabular"
                  value={agentCommissionRate}
                  onChange={(e) => setAgentCommissionRate(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ep-ins-toggle" className="text-xs font-semibold uppercase tracking-wide">
                  Override insurance rate
                </Label>
                <Switch id="ep-ins-toggle" checked={insuranceOverride} onCheckedChange={setInsuranceOverride} />
              </div>
              <p className="text-xs text-muted-foreground">
                By default, insurance is calculated from the standard tenor-based rate table. Turn
                this on to charge a flat rate instead.
              </p>
              {insuranceOverride ? (
                <Input
                  id="ep-ins-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  className="tabular"
                  placeholder="e.g. 1.5"
                  value={insuranceRate}
                  onChange={(e) => setInsuranceRate(e.target.value)}
                  aria-label="Flat insurance rate (%)"
                />
              ) : null}
            </div>

            {formError ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || productQuery.isLoading}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
