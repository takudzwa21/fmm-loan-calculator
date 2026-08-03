import { ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DownloadMenu({
  label,
  onDownloadPdf,
  onDownloadExcel,
}: {
  label: string;
  onDownloadPdf: () => void;
  onDownloadExcel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <FileText className="size-4" aria-hidden="true" />
          {label}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDownloadPdf}>
          <FileText className="size-4" aria-hidden="true" />
          PDF (branded, client-ready)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownloadExcel}>
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
