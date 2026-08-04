const CONFIGURED_ENGINE_URL = (import.meta.env["VITE_ENGINE_API_URL"] as string | undefined)?.replace(
  /\/$/,
  "",
);

// In dev, default to the local engine so `npm run dev` works with zero config.
// In a deployed build, there is no sane default — 127.0.0.1 means "the
// visitor's own machine," not a server — so leave it unset and fail loudly
// instead of silently trying (and failing) to reach localhost.
export const ENGINE_URL = CONFIGURED_ENGINE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");

export type Product = {
  id: string;
  name: string;
  currency: string;
  portfolio: string;
  version: string;
  custom?: boolean;
};

export type InterestMode = "input" | "fixed" | "tiered";
export type InterestCalculationMethod = "reducing_balance" | "straight_line";

export type ChargeComponent = {
  key: string;
  label: string;
  kind: "pct" | "pct_by_channel" | "flat" | "flat_by_channel" | "insurance" | "custom";
  rate?: number | Record<string, number> | null;
  amount?: number | Record<string, number> | null;
  base?: string;
  origin_gate?: string | null;
  include_in_total?: boolean;
};

export type ProductConfig = {
  id?: string;
  name?: string;
  currency?: string;
  portfolio?: string;
  version?: string;
  notes?: string;
  interest?: {
    mode?: InterestMode;
    value?: number;
    low?: number;
    high?: number;
    threshold?: number;
    default_rate?: number | null;
  };
  interest_method?: InterestCalculationMethod;
  das_commission_rate?: number;
  das_method?: "grossup" | "simple";
  charge_base?: string;
  topup_model?: string;
  pmt_base?: string;
  pmt_round?: number | null;
  charges?: ChargeComponent[];
  insurance_rate_override?: number | null;
  custom?: boolean;
  [key: string]: unknown;
};

export type NewProductInput = {
  inherit_from?: string;
} & ProductConfig;

export type AmortRow = {
  period: number;
  opening_balance: number;
  instalment: number;
  interest: number;
  principal: number;
  closing_balance: number;
};

export type QuotePayload = {
  product_id: string;
  loan_amount: number;
  tenor: number;
  origin: string;
  channel: string;
  loan_type: string;
  interest_rate: number;
  interest_method: InterestCalculationMethod;
  application_date: string;
  original_loan: number;
  old_tenor: number;
  current_balance: number;
  instalments_paid: number;
};

export type ClientInfo = {
  full_name: string;
  officer: string;
};

export type FxBlock = {
  currency: string;
  rate: number;
  net_loan: number;
  total_instalment: number;
  total_charges: number;
  total_repayable: number;
  total_interest: number;
  total_cost_of_credit: number;
};

export type QuoteResponse = {
  product_id: string;
  product_name: string;
  currency: string;
  portfolio: string;
  loan_type: string;
  origin: string;
  channel: string;
  tenor: number;
  interest_rate: number;
  interest_method: InterestCalculationMethod;
  gross_loan_on_contract: number;
  gross_loan_after_liquidation: number;
  charges: Record<string, number>;
  total_charges: number;
  net_loan: number;
  indicative_instalment: number;
  das_commission: number;
  total_instalment: number;
  insurance_breakdown: Record<string, number> | null;
  expected_instalment_start: string;
  expected_instalment_end: string;
  total_repayable: number;
  total_interest: number;
  total_cost_of_credit: number;
  effective_apr: number;
  amortisation: AmortRow[];
  warnings: string[];
  fx: FxBlock | null;
};

export type QuoteHistorySummary = {
  id: string;
  created_at: string;
  updated_at: string | null;
  quote_ref: string | null;
  client_name: string;
  officer: string;
  product_id: string;
  product_name: string;
  currency: string;
  loan_type: string;
  tenor: number;
  net_loan: number;
  total_instalment: number;
};

export type QuoteHistoryRecord = {
  id: string;
  created_at: string;
  updated_at: string | null;
  quote_ref: string | null;
  client_name: string;
  officer: string;
  application: QuotePayload & { product_id: string };
  fx_rate: number | null;
  fx_currency: string | null;
  quote: QuoteResponse;
};

export class EngineError extends Error {
  constructor(
    message: string,
    public kind: "validation" | "network" | "server" | "unconfigured",
  ) {
    super(message);
    this.name = "EngineError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!ENGINE_URL) {
    throw new EngineError(
      "No calculation engine URL is configured for this deployment. Set VITE_ENGINE_API_URL " +
        "in your hosting provider's environment variables and redeploy.",
      "unconfigured",
    );
  }

  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new EngineError(
      `Cannot reach the calculation engine at ${ENGINE_URL}. Check the connection or the engine URL.`,
      "network",
    );
  }

  if (!res.ok) {
    let detail = `The engine returned an error (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* keep default */
    }
    throw new EngineError(detail, res.status === 400 || res.status === 422 ? "validation" : "server");
  }

  return (await res.json()) as T;
}

export const fetchProducts = () => request<Product[]>("/products");

export const fetchProduct = (id: string) =>
  request<ProductConfig>(`/products/${encodeURIComponent(id)}`);

export type QuoteRequestBody = {
  payload: QuotePayload;
  fx_rate: number | null;
  fx_currency: string | null;
  client?: ClientInfo;
  quote_ref?: string;
};

export const postQuote = (body: QuoteRequestBody) =>
  request<QuoteResponse>("/quote", { method: "POST", body: JSON.stringify(body) });

export const createProduct = (body: NewProductInput) =>
  request<ProductConfig>("/products", { method: "POST", body: JSON.stringify(body) });

export const updateProduct = (id: string, body: ProductConfig) =>
  request<ProductConfig>(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteProduct = (id: string) =>
  request<{ deleted: string }>(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchQuoteHistory = (
  params: { q?: string | undefined; sort?: string | undefined; order?: "asc" | "desc" | undefined } = {},
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<QuoteHistorySummary[]>(`/quotes${suffix}`);
};

export const fetchQuoteHistoryRecord = (id: string) =>
  request<QuoteHistoryRecord>(`/quotes/${encodeURIComponent(id)}`);

export const updateQuoteHistoryRecord = (id: string, body: Partial<QuoteRequestBody>) =>
  request<QuoteHistoryRecord>(`/quotes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteQuoteHistoryRecord = (id: string) =>
  request<{ deleted: string }>(`/quotes/${encodeURIComponent(id)}`, { method: "DELETE" });
