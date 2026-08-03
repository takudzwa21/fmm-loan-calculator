import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Eye,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import {
  deleteQuoteHistoryRecord,
  fetchQuoteHistory,
  fetchQuoteHistoryRecord,
  type QuoteHistoryRecord,
  type QuoteHistorySummary,
} from "@/lib/engine";
import { longDate, money } from "@/lib/format";
import { downloadAmortisationSchedulePdf, downloadQuotePdf } from "@/lib/pdf";
import { downloadAmortisationScheduleWorkbook, downloadQuoteWorkbook } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DownloadMenu } from "./DownloadMenu";
import { HistoryEditDialog } from "./HistoryEditDialog";
import { ResultsPanel } from "./ResultsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SortKey = "created_at" | "client_name" | "product_name" | "net_loan" | "total_instalment";

function SortButton({
  label,
  active,
  order,
  onClick,
}: {
  label: string;
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      {active ? (
        order === "asc" ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )
      ) : null}
    </button>
  );
}

function reportMetaFrom(record: QuoteHistoryRecord) {
  return {
    clientName: record.client_name,
    officer: record.officer,
    productVersion: "",
    applicationDate: record.application.application_date,
    quoteRef: record.quote_ref ?? record.id.slice(0, 8).toUpperCase(),
  };
}

export function HistoryView() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [viewRecord, setViewRecord] = useState<QuoteHistoryRecord | null>(null);
  const [editRecord, setEditRecord] = useState<QuoteHistoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteHistorySummary | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["quote-history", q, sort, order],
    queryFn: () => fetchQuoteHistory({ q: q || undefined, sort, order }),
    retry: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuoteHistoryRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-history"] });
      setDeleteTarget(null);
    },
  });

  const toggleSort = (key: SortKey) => {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setOrder("desc");
    }
  };

  const loadRecord = async (id: string) => {
    setRowError(null);
    try {
      return await fetchQuoteHistoryRecord(id);
    } catch {
      setRowError("Could not load that quote. It may have been deleted.");
      return null;
    }
  };

  const rows = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Quote history</h1>
          <p className="text-xs text-muted-foreground">
            Every quote calculated in this engine, searchable and editable.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, officer, product…"
            className="pl-8"
            aria-label="Search quote history"
          />
        </div>
      </div>

      {listQuery.isError ? (
        <Card className="border-destructive/40 bg-destructive-surface">
          <CardContent className="flex gap-2 pt-6 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-semibold text-destructive">Cannot reach the calculation engine</p>
              <p className="mt-1 text-foreground">{(listQuery.error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {rowError ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {rowError}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {q ? "No quotes match your search." : "No quotes calculated yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton
                      label="Date"
                      active={sort === "created_at"}
                      order={order}
                      onClick={() => toggleSort("created_at")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="Client"
                      active={sort === "client_name"}
                      order={order}
                      onClick={() => toggleSort("client_name")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="Product"
                      active={sort === "product_name"}
                      order={order}
                      onClick={() => toggleSort("product_name")}
                    />
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Tenor</TableHead>
                  <TableHead className="text-right">
                    <SortButton
                      label="Net loan"
                      active={sort === "net_loan"}
                      order={order}
                      onClick={() => toggleSort("net_loan")}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton
                      label="Instalment"
                      active={sort === "total_instalment"}
                      order={order}
                      onClick={() => toggleSort("total_instalment")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular text-xs">{longDate(r.created_at.slice(0, 10))}</TableCell>
                    <TableCell>{r.client_name || "Unnamed client"}</TableCell>
                    <TableCell className="text-sm">{r.product_name}</TableCell>
                    <TableCell className="text-xs">{r.loan_type}</TableCell>
                    <TableCell className="text-right tabular">{r.tenor}</TableCell>
                    <TableCell className="text-right tabular">{money(r.net_loan, r.currency)}</TableCell>
                    <TableCell className="text-right tabular">
                      {money(r.total_instalment, r.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="View quote"
                          onClick={async () => setViewRecord(await loadRecord(r.id))}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Edit quote"
                          onClick={async () => setEditRecord(await loadRecord(r.id))}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <DownloadMenu
                          label=""
                          onDownloadPdf={async () => {
                            const rec = await loadRecord(r.id);
                            if (rec) downloadQuotePdf(rec.quote, reportMetaFrom(rec));
                          }}
                          onDownloadExcel={async () => {
                            const rec = await loadRecord(r.id);
                            if (rec) downloadQuoteWorkbook(rec.quote, reportMetaFrom(rec));
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label="Delete quote"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewRecord?.client_name || "Unnamed client"} · {viewRecord?.quote.product_name}
            </DialogTitle>
          </DialogHeader>
          {viewRecord ? (
            <ResultsPanel
              quote={viewRecord.quote}
              onPrint={() => downloadQuotePdf(viewRecord.quote, reportMetaFrom(viewRecord))}
              onExportPdf={() => downloadQuotePdf(viewRecord.quote, reportMetaFrom(viewRecord))}
              onExportExcel={() => downloadQuoteWorkbook(viewRecord.quote, reportMetaFrom(viewRecord))}
            />
          ) : null}
          {viewRecord ? (
            <div className="flex justify-end">
              <DownloadMenu
                label="Download schedule"
                onDownloadPdf={() =>
                  downloadAmortisationSchedulePdf(viewRecord.quote, reportMetaFrom(viewRecord))
                }
                onDownloadExcel={() =>
                  downloadAmortisationScheduleWorkbook(viewRecord.quote, reportMetaFrom(viewRecord))
                }
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <HistoryEditDialog
        record={editRecord}
        onOpenChange={(o) => !o && setEditRecord(null)}
        onSaved={() => setEditRecord(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This permanently removes the quote for ${deleteTarget.client_name || "this client"} (${deleteTarget.product_name}) from history. This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
