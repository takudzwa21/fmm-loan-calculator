export function Footer() {
  return (
    <footer className="no-print mt-8 border-t bg-card">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          First Mutual Microfinance (Pvt) Ltd. Internal use only. Figures are indicative and
          subject to credit approval.
        </p>
        <p>
          For assistance:{" "}
          <a href="mailto:tchikomo@firstmutual.co.zw" className="font-medium hover:text-foreground">
            tchikomo@firstmutual.co.zw
          </a>{" "}
          · <span className="tabular">+263 77 145 4843</span>
        </p>
      </div>
    </footer>
  );
}
