import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  EngineError,
  updateQuoteHistoryRecord,
  type QuoteHistoryRecord,
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

export function HistoryEditDialog({
  record,
  onOpenChange,
  onSaved,
}: {
  record: QuoteHistoryRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [officer, setOfficer] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [tenor, setTenor] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    setClientName(record.client_name);
    setOfficer(record.officer);
    setLoanAmount(String(record.application.loan_amount));
    setTenor(String(record.application.tenor));
    setInterestRate(String(Math.round(record.application.interest_rate * 10000) / 100));
    setFormError(null);
  }, [record]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!record) throw new Error("No record");
      return updateQuoteHistoryRecord(record.id, {
        payload: {
          ...record.application,
          loan_amount: Number(loanAmount),
          tenor: Number(tenor),
          interest_rate: Number(interestRate) / 100,
        },
        client: { full_name: clientName, officer },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-history"] });
      onSaved();
    },
    onError: (err) =>
      setFormError(err instanceof EngineError ? err.message : "Could not update this quote."),
  });

  const submit = () => {
    setFormError(null);
    if (!loanAmount.trim() || Number(loanAmount) <= 0) return setFormError("Enter a valid loan amount.");
    if (!tenor.trim() || Number(tenor) <= 0) return setFormError("Enter a valid tenor.");
    mutation.mutate();
  };

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit quote</DialogTitle>
          <DialogDescription>
            Adjusting these figures recalculates the quote with the {record?.quote.product_name}{" "}
            engine and updates this history record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="he-client" className="text-xs font-semibold uppercase tracking-wide">
                Client name
              </Label>
              <Input id="he-client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="he-officer" className="text-xs font-semibold uppercase tracking-wide">
                Loan officer / branch
              </Label>
              <Input id="he-officer" value={officer} onChange={(e) => setOfficer(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="he-amount" className="text-xs font-semibold uppercase tracking-wide">
                Loan amount
              </Label>
              <Input
                id="he-amount"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="he-tenor" className="text-xs font-semibold uppercase tracking-wide">
                Tenor (months)
              </Label>
              <Input
                id="he-tenor"
                type="number"
                min={1}
                step={1}
                className="tabular"
                value={tenor}
                onChange={(e) => setTenor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="he-rate" className="text-xs font-semibold uppercase tracking-wide">
                Rate (% monthly)
              </Label>
              <Input
                id="he-rate"
                type="number"
                min={0}
                step="0.01"
                className="tabular"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>
          </div>

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
            {mutation.isPending ? "Saving…" : "Save and recalculate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
