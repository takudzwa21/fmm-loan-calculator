import { Link } from "@tanstack/react-router";
import fmmLogo from "@/assets/fmm-logo.png";
import { longDate, todayISO } from "@/lib/format";

export function AppBar() {
  return (
    <header className="no-print bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
        <div
          className="flex h-10 shrink-0 items-center rounded bg-white px-2 py-1"
          aria-hidden="true"
        >
          <img src={fmmLogo} alt="" className="h-full w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight tracking-tight">
            First Mutual Microfinance
          </p>
          <p className="truncate text-xs leading-tight text-primary-foreground/85">
            Loan Charges Calculator
          </p>
        </div>
        <nav className="ml-6 hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Link
            to="/"
            className="rounded px-3 py-1.5 text-sm font-medium text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-primary-foreground/15! text-primary-foreground!" }}
          >
            Calculator
          </Link>
          <Link
            to="/history"
            className="rounded px-3 py-1.5 text-sm font-medium text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            activeProps={{ className: "bg-primary-foreground/15! text-primary-foreground!" }}
          >
            History
          </Link>
        </nav>
        <div className="ml-auto hidden text-right sm:block">
          <p className="text-xs font-medium tabular">{longDate(todayISO())}</p>
          <p className="text-[11px] text-primary-foreground/80">Internal Use</p>
        </div>
      </div>
    </header>
  );
}
