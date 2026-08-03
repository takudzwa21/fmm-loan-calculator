# FMM Loan Genie

## 1. What to build

Build a professional, internal web application called **FMM Loan Charges Calculator** for **First Mutual Microfinance (Pvt) Ltd**. It lets staff, from loan officers to executives, capture a client's loan request, calculate all charges and the repayment, view a full amortisation schedule, and download a branded, client-ready PDF or Excel workbook of the quote or the schedule. It also keeps a searchable history of every quote calculated, and lets staff define new loan products (from scratch or inherited from an existing one). It is an internal corporate tool, so prioritise clarity, speed, accuracy, consistency and accessibility over decoration.

The calculation logic already exists as a validated **REST API** (the "FMM Loan Charges Engine"). **Do not re-implement any loan maths in the front-end.** The app collects inputs, sends them to the API, and renders the response. Put the API base URL in an environment variable `VITE_ENGINE_API_URL` (default `http://127.0.0.1:8000`).

## 2. Tech & structure

- React + TypeScript + Tailwind + shadcn/ui components.
- A single primary screen (the calculator). Add a slim top app bar and a footer.
- Use `@tanstack/react-query` (or fetch) for API calls, with loading and error states.
- Use **jsPDF + jspdf-autotable** for the client-side, branded PDF export (see `src/lib/pdf.ts`), and **SheetJS (`xlsx`)** for the Excel alternative (see `src/lib/excel.ts`). Every download offers a PDF/Excel choice.
- Fully responsive (desktop-first, but usable on tablet). Include a clean **print stylesheet** so any quote/schedule prints tidily on A4.

## 3. Brand & theme (First Mutual red)

- Primary brand colour: **red `#C8102E`** (First Mutual red). Hover/active: `#A00D24`. Use sparingly for the app bar, primary buttons, active states, table header accents and key figures — not large flood-fills.
- Neutrals: near-black text `#1A1A1A`, greys `#6B7280` / `#E5E7EB`, page background `#F7F7F8`, cards white `#FFFFFF`.
- Success `#137333`, warning `#B45309`, error `#B91C1C` (used only for status, never as brand).
- Typography: a clean corporate sans-serif (Inter / system UI). Clear type scale, generous line height, numeric figures right-aligned and monospaced-tabular in tables.
- App bar: FMM red, the First Mutual logo (`src/assets/fmm-logo.png`) and a wordmark **"First Mutual Microfinance"** with subtitle **"Loan Charges Calculator"**. Right side: current date.
- Keep it restrained and executive-appropriate: whitespace, alignment, subtle shadows, no gradients or playful elements.

## 4. API contract (bind the UI to these)

**GET `/products`** → list for the calculator dropdown:
```json
[{"id":"USD_SSB","name":"USD Loans Calculator (SSB)","currency":"USD","portfolio":"SSB","version":"v6.2026.1"}]
```

**GET `/products/{id}`** → full product config. Read `interest.mode` from it to decide field visibility (see §5): if `"input"`, show the Interest Rate field; if `"fixed"`/`"tiered"`, hide it (the rate is fixed by the product).

**POST `/quote`** → body:
```json
{
  "payload": {
    "product_id": "USD_SSB",
    "loan_amount": 6000,
    "tenor": 24,
    "origin": "AGENT",
    "channel": "BANK",
    "loan_type": "NEW",
    "interest_rate": 0.08,
    "application_date": "2026-07-31",
    "original_loan": 0,
    "old_tenor": 0,
    "current_balance": 0,
    "instalments_paid": 0
  },
  "fx_rate": null,
  "fx_currency": null
}
```
Response (render all of this):
```json
{
  "product_name": "USD Loans Calculator (SSB)",
  "currency": "USD",
  "portfolio": "SSB",
  "loan_type": "NEW",
  "origin": "AGENT",
  "channel": "BANK",
  "tenor": 24,
  "interest_rate": 0.08,
  "gross_loan_on_contract": 6000.0,
  "gross_loan_after_liquidation": 6000.0,
  "charges": {"ESTABLISHMENT FEES": 420.0, "INSURANCE": 122.4, "AGENT COMMISSION": 120.0},
  "total_charges": 662.4,
  "net_loan": 5337.6,
  "indicative_instalment": 570.0,
  "das_commission": 17.63,
  "total_instalment": 587.63,
  "insurance_breakdown": {"net_premium": 122.4, "gross_premium": 122.4, "upr": 0.0, "initial_premium": 0.0, "resultant_balance": 6000.0, "rate_used": 0.0204},
  "expected_instalment_start": "2026-08-01",
  "expected_instalment_end": "2028-07-31",
  "total_repayable": 13680.0,
  "total_interest": 7680.0,
  "total_cost_of_credit": 8342.4,
  "effective_apr": 151.9,
  "amortisation": [{"period":1,"opening_balance":6000.0,"instalment":570.0,"interest":480.0,"principal":90.0,"closing_balance":5910.0}],
  "warnings": ["..."],
  "fx": null
}
```

On a `400` the body has a `detail` string (validation message) — show it inline, don't crash.

## 5. Input form (left panel / top section)

Group inputs into labelled cards. Every field has a visible label, helper text where useful, and inline validation. Fields:

**Client details**
- Client name (text, required for the printed offer; default label if blank).
- Loan officer / branch (text, optional, prefill "Melinda Muredzi" as an example placeholder).

**Loan request**
- **Calculator / Product** — dropdown from `/products`, showing `name` with a currency badge. Required.
- **Loan type** — segmented control: `NEW` / `TOP-UP`.
- **Loan amount** (number, currency-prefixed by the product's currency; label switches to **"Top-up amount"** when Loan type = TOP-UP). Required, > 0.
- **Tenor (months)** (number, integer, > 0). Show a soft warning chip if > 84 ("beyond the insurance table — rate extrapolated").
- **Loan origination** — segmented control: `BRANCH` / `AGENT`.
- **Disbursement channel** — segmented control: `BANK` / `ECOCASH`.
- **Interest rate (monthly)** — number as a percentage input (user types `8`, send `0.08`). **Only visible when the selected product's `interest.mode === "input"`.** Otherwise hide it and show a small note: "Rate fixed by product."
- **Application date** — date picker, default today.

**Existing loan (only visible when Loan type = TOP-UP)** — reveal this card conditionally:
- Original loan amount (number)
- Original tenor (months) (integer)
- Current outstanding balance (number)
- Instalments already paid (integer)

**Optional — FX equivalent** (collapsible, off by default): a toggle plus a target currency and exchange rate; when on, pass `fx_rate`/`fx_currency` and show the returned `fx` block in the results.

Primary action button (FMM red): **"Calculate"**. Secondary: **"Reset"**. Debounce/disable the button while a request is in flight; show a spinner.

## 6. Results panel (right / below)

Only appears after a successful calculation. Lay it out as scannable summary cards then detail:

**Headline cards** (large, the numbers executives look at first):
- **Net Amount Disbursed** (`net_loan`) — most prominent, in brand red.
- **Monthly Instalment** (`total_instalment`).
- **Total Charges** (`total_charges`).
- **Effective APR** (`effective_apr`, one decimal, with a small tooltip: "Annualised effective interest rate implied by the repayments").

**Charges breakdown** — a clean table of every line in `charges` (label + amount), then a bold **Total charges** row. Show `gross_loan_on_contract`, and `gross_loan_after_liquidation` when it differs (top-ups).

**Repayment summary** — indicative instalment, D.A.S commission, total instalment, total repayable, total interest, total cost of credit, and the schedule window (`expected_instalment_start` → `expected_instalment_end`).

**Insurance breakdown** — collapsible; show `insurance_breakdown` fields with readable labels (Net premium, Gross premium, UPR, Initial premium, Resultant balance, Rate used).

**Warnings** — if `warnings` is non-empty, show a warning-styled callout listing them.

Format money as `{CURRENCY} #,##0.00`; percentages with one decimal; dates as `DD MMM YYYY`. Right-align all numeric columns.

Provide **"Print offer"** and a **"Download quote"** split button (PDF or Excel) here. Both produce a client-ready document (FMM logo letterhead, client/product/loan summary, charges breakdown, repayment summary and the full amortisation schedule) with the "Indicative only, subject to credit approval and affordability checks" disclaimer. No client-identifying data beyond name and officer is included, and no personal staff contact details are printed on generated documents.

## 7. Amortisation schedule + download

Below the results, an **Amortisation schedule** section (collapsible, collapsed by default with a "Show schedule" toggle since it can be long). Render `amortisation` as a table with columns: **#**, **Opening balance**, **Instalment**, **Interest**, **Principal**, **Closing balance**. Zebra striping, sticky header, right-aligned numbers, a totals row at the bottom (sum of instalment/interest/principal).

A prominent **"Download schedule"** split button generates either a branded `.pdf` (`src/lib/pdf.ts`, FMM logo letterhead, client/loan summary block, header row repeated on every page, totals row on the last page) or an `.xlsx` (`src/lib/excel.ts`). Trigger a real file download either way.

## 8. HCI / usability standards (apply throughout)

- **WCAG 2.1 AA**: colour contrast ≥ 4.5:1 for text (check red-on-white and white-on-red — use `#C8102E`/darker as needed), visible keyboard focus rings, full keyboard operability, every input has a programmatic `<label>`, and status/errors are announced (aria-live for the results and error region). Don't rely on colour alone — pair warning/error colour with an icon and text.
- **Nielsen heuristics**: visible system status (loading spinners), match real-world terms staff use (the exact labels above), user control (Reset, clear/edit freely), consistency, error prevention (numeric inputs, min/step, disable Calculate until required fields are valid), clear recognition over recall (defaults, inline help), and helpful error messages (show the API `detail` verbatim, phrased for humans).
- **Forms**: logical top-to-bottom, left-to-right order; grouped sections; sensible tab order; Enter submits; inline validation on blur, not just on submit; required fields marked; units and currency shown next to fields; sensible defaults (date = today, origination = BRANCH, channel = BANK).
- **Feedback & safety**: confirm nothing destructive silently; Reset asks for confirmation if the form has data; never lose entered data on a failed API call.
- **Performance & states**: skeleton/spinner while fetching products and while calculating; empty state before first calculation ("Enter loan details and press Calculate"); graceful error card if the API is unreachable ("Cannot reach the calculation engine — check the connection/URL").
- **Density for pros**: compact but not cramped; support quick repeat use (after a calculation the form stays populated so an officer can tweak one field and recalculate). Consider a subtle "New client" button to clear.
- **Trust**: label all outputs as **indicative**.

## 9. Layout summary

- Top app bar (FMM red) with wordmark + subtitle + date.
- Two-column workspace on desktop: **left** = input form cards (§5); **right** = results (§6) with the amortisation section (§7) full-width beneath. On smaller screens, stack: form, then results, then schedule.
- Footer: "First Mutual Microfinance (Pvt) Ltd — Internal use only. Figures are indicative and subject to credit approval." plus contact details for assistance (email and phone).

## 10. Acceptance checklist

- [ ] Product dropdown loads from `/products`; interest-rate field shows only for input-rate products.
- [ ] TOP-UP reveals the existing-loan fields; NEW hides them.
- [ ] Calculate posts to `/quote` and renders every response field with correct money/%/date formatting.
- [ ] Amortisation table renders with a totals row; "Download Schedule (PDF)" produces a branded, letterheaded PDF.
- [ ] Print offer and "Download quote (PDF)" both produce a clean, branded, client-ready output with the disclaimer and the amortisation schedule.
- [ ] Validation, loading, error and empty states all behave; API `400` messages shown inline.
- [ ] Keyboard-navigable, AA-contrast, labelled inputs, aria-live results — verified.
- [ ] FMM red theme applied consistently; restrained and corporate.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ebea0761-8708-451b-9034-7bc7cd1c867a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Running the calculation engine

The front-end talks to the FMM Loan Charges Engine over HTTP (see §4). Locally, that
engine is `fmm_calculator.py` (the calculators, amortisation and quoting logic) served
by `fmm_server.py` (a dependency-free `http.server` wrapper implementing the
`/products`, `/products/{id}` and `/quote` routes). Run it alongside `npm run dev`,
in a separate terminal:

```sh
python fmm_server.py            # serves on http://127.0.0.1:8000, matching the front-end default
```

You can point the front-end at a different engine URL by setting `VITE_ENGINE_API_URL`
in a `.env` file. Run `python fmm_calculator.py --test` to self-check the engine against
the original workbook figures, or `python fmm_calculator.py` for the interactive CLI.
