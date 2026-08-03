#!/usr/bin/env python3
"""
FMM LOAN CHARGES CALCULATOR — complete standalone engine
========================================================

One self-contained file. No other files, no installs. Just:

    python fmm_calculator.py          # interactive calculator (asks for input)
    python fmm_calculator.py --test   # self-check against the original workbooks
    python fmm_calculator.py --list   # list available calculators

It reproduces every FMM Excel loan-charges calculator (USD, ZiG, SME USD, SSB,
TERTIARY, EcoCash) and adds an amortisation schedule, total cost of credit,
effective APR, top-up handling, and a printable client offer.

Python 3.9+ (standard library only).
"""
from __future__ import annotations

import sys
import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Union


# =====================================================================
# REFERENCE DATA — insurance rate table (External : 20% Commission col)
# =====================================================================
INSURANCE_RATE_TABLE: Dict[int, float] = {
    1: 0.001, 2: 0.002, 3: 0.003, 4: 0.004, 5: 0.005, 6: 0.006, 7: 0.007,
    8: 0.008, 9: 0.009, 10: 0.01, 11: 0.011, 12: 0.012, 13: 0.0127,
    14: 0.0134, 15: 0.0141, 16: 0.0148, 17: 0.0155, 18: 0.0162, 19: 0.0169,
    20: 0.0176, 21: 0.0183, 22: 0.019, 23: 0.0197, 24: 0.0204, 25: 0.0212,
    26: 0.022, 27: 0.0228, 28: 0.0236, 29: 0.0244, 30: 0.0252, 31: 0.026,
    32: 0.0268, 33: 0.0276, 34: 0.0284, 35: 0.0292, 36: 0.03, 37: 0.0309,
    38: 0.0318, 39: 0.0327, 40: 0.0336, 41: 0.0345, 42: 0.0354, 43: 0.0363,
    44: 0.0372, 45: 0.0381, 46: 0.039, 47: 0.0399, 48: 0.0408, 49: 0.0418,
    50: 0.0428, 51: 0.0438, 52: 0.0448, 53: 0.0458, 54: 0.0468, 55: 0.0478,
    56: 0.0488, 57: 0.0498, 58: 0.0508, 59: 0.0518, 60: 0.0528, 61: 0.0538,
    62: 0.0548, 63: 0.0558, 64: 0.0568, 65: 0.0578, 66: 0.0588, 67: 0.0598,
    68: 0.0608, 69: 0.0618, 70: 0.0628, 71: 0.0638, 72: 0.0648, 73: 0.0659,
    74: 0.067, 75: 0.0681, 76: 0.0692, 77: 0.0703, 78: 0.0714, 79: 0.0725,
    80: 0.0736, 81: 0.0747, 82: 0.0758, 83: 0.0769, 84: 0.078,
}


def insurance_rate(tenor: int, table: Optional[Dict[int, float]] = None) -> float:
    table = table or INSURANCE_RATE_TABLE
    if tenor in table:
        return table[tenor]
    if tenor <= 0:
        return 0.0
    keys = sorted(table)
    if tenor < keys[0]:
        return table[keys[0]]
    a, b = keys[-2], keys[-1]
    slope = (table[b] - table[a]) / (b - a)
    return round(table[b] + slope * (tenor - b), 6)


# =====================================================================
# EXCEL-COMPATIBLE HELPERS
# =====================================================================
def pmt(rate: float, nper: int, pv: float, fv: float = 0.0, when: int = 0) -> float:
    if nper == 0:
        return 0.0
    if rate == 0:
        return -(pv + fv) / nper
    factor = (1 + rate) ** nper
    return -(pv * factor + fv) * rate / ((factor - 1) * (1 + rate * when))


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    last = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return date(y, m, min(d.day, last))


def month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def instalment_dates(application_date: date, tenor: int, start_offset_months: int = 1):
    start = add_months(month_start(application_date), start_offset_months)
    end_first = add_months(start, tenor - 1)
    end = date(end_first.year, end_first.month, 1)
    end = add_months(end, 1) - timedelta(days=1)
    return start, end


# =====================================================================
# VOCAB
# =====================================================================
ORIGIN_BRANCH, ORIGIN_AGENT = "BRANCH", "AGENT"
CHANNEL_BANK, CHANNEL_ECOCASH = "BANK", "ECOCASH"
LOAN_NEW, LOAN_TOPUP = "NEW", "TOP-UP"


# =====================================================================
# CHARGE COMPONENT / INTEREST / PRODUCT CONFIG
# =====================================================================
@dataclass
class ChargeComponent:
    key: str
    label: str
    kind: str
    rate: Union[float, Dict[str, float], None] = None
    amount: Union[float, Dict[str, float], None] = None
    base: str = "loan_amount"
    origin_gate: Optional[str] = None
    include_in_total: bool = True
    custom: Optional[Callable[[Dict[str, Any]], float]] = None

    def resolve(self, ctx: Dict[str, Any]) -> float:
        if self.origin_gate and ctx["origin"] != self.origin_gate:
            return 0.0
        base_val = ctx["bases"][self.base]
        channel = ctx["channel"]
        if self.kind == "pct":
            return base_val * float(self.rate)
        if self.kind == "pct_by_channel":
            return base_val * float(self.rate[channel])
        if self.kind == "flat":
            return float(self.amount)
        if self.kind == "flat_by_channel":
            return float(self.amount[channel])
        if self.kind == "insurance":
            return ctx["insurance_premium"]
        if self.kind == "custom":
            return float(self.custom(ctx))
        raise ValueError(f"Unknown charge kind: {self.kind}")


@dataclass
class InterestRule:
    mode: str = "fixed"
    value: float = 0.0
    low: float = 0.0
    high: float = 0.0
    threshold: int = 17
    default_rate: Optional[float] = None  # UI pre-fill for mode="input"; user may still override

    def resolve(self, tenor: int, application_rate: Optional[float]) -> float:
        if self.mode == "fixed":
            return self.value
        if self.mode == "input":
            if application_rate is None:
                if self.default_rate is not None:
                    return self.default_rate
                raise ValueError("This product requires an interest_rate.")
            return application_rate
        if self.mode == "tiered":
            return self.low if tenor <= self.threshold else self.high
        raise ValueError(f"Unknown interest mode: {self.mode}")


@dataclass
class ProductConfig:
    id: str
    name: str
    currency: str
    portfolio: str
    interest: InterestRule = field(default_factory=InterestRule)
    interest_method: str = "reducing_balance"  # or "straight_line"; overridable per application
    das_commission_rate: float = 0.0
    das_method: str = "grossup"
    charge_base: str = "loan_amount"
    topup_model: str = "additive"
    pmt_base: str = "gross_on_contract"
    pmt_round: Optional[int] = None
    charges: List[ChargeComponent] = field(default_factory=list)
    insurance_table: Dict[int, float] = field(default_factory=lambda: dict(INSURANCE_RATE_TABLE))
    insurance_rate_override: Optional[float] = None  # flat monthly rate; None = use insurance_table
    start_offset_months: int = 1
    version: str = ""
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        for c in d["charges"]:
            c.pop("custom", None)
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ProductConfig":
        d = dict(d)
        if isinstance(d.get("interest"), dict):
            d["interest"] = InterestRule(**d["interest"])
        d["charges"] = [ChargeComponent(**{k: v for k, v in c.items() if k != "custom"})
                        for c in d.get("charges", [])]
        if d.get("insurance_table"):
            d["insurance_table"] = {int(k): float(v) for k, v in d["insurance_table"].items()}
        return cls(**d)


# =====================================================================
# APPLICATION / QUOTE
# =====================================================================
@dataclass
class LoanApplication:
    product_id: str
    loan_amount: float
    tenor: int
    origin: str = ORIGIN_BRANCH
    channel: str = CHANNEL_BANK
    loan_type: str = LOAN_NEW
    interest_rate: Optional[float] = None
    interest_method: Optional[str] = None  # "reducing_balance" | "straight_line"; None = product default
    application_date: Optional[date] = None
    original_loan: float = 0.0
    old_tenor: int = 0
    current_balance: float = 0.0
    instalments_paid: int = 0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.application_date:
            d["application_date"] = self.application_date.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "LoanApplication":
        d = dict(d)
        ad = d.get("application_date")
        if isinstance(ad, str) and ad:
            d["application_date"] = date.fromisoformat(ad)
        return cls(**d)


@dataclass
class LoanQuote:
    product_id: str
    product_name: str
    currency: str
    portfolio: str
    loan_type: str
    origin: str
    channel: str
    tenor: int
    interest_rate: float
    interest_method: str
    gross_loan_on_contract: float
    gross_loan_after_liquidation: float
    charges: Dict[str, float]
    total_charges: float
    net_loan: float
    indicative_instalment: float
    das_commission: float
    total_instalment: float
    insurance_breakdown: Dict[str, float]
    expected_instalment_start: Optional[str]
    expected_instalment_end: Optional[str]
    total_repayable: float
    total_interest: float
    total_cost_of_credit: float
    effective_apr: float
    amortisation: List[Dict[str, float]]
    warnings: List[str] = field(default_factory=list)
    fx: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)


# =====================================================================
# ENGINE
# =====================================================================
class LoanChargesEngine:
    def __init__(self, configs: Optional[Dict[str, ProductConfig]] = None):
        self.configs: Dict[str, ProductConfig] = dict(configs or {})

    def register(self, config: ProductConfig) -> None:
        self.configs[config.id] = config

    def add_config_from_dict(self, d: Dict[str, Any]) -> ProductConfig:
        cfg = ProductConfig.from_dict(d)
        self.register(cfg)
        return cfg

    def load_configs_json(self, path_or_text: str, is_text: bool = False) -> None:
        text = path_or_text if is_text else open(path_or_text, encoding="utf-8").read()
        data = json.loads(text)
        for d in (data if isinstance(data, list) else data.get("products", [])):
            self.add_config_from_dict(d)

    def export_configs_json(self, indent: int = 2) -> str:
        return json.dumps({"products": [c.to_dict() for c in self.configs.values()]},
                          indent=indent, default=str)

    def list_products(self) -> List[Dict[str, str]]:
        return [{"id": c.id, "name": c.name, "currency": c.currency,
                 "portfolio": c.portfolio, "version": c.version}
                for c in self.configs.values()]

    def currencies(self) -> List[str]:
        return sorted({c.currency for c in self.configs.values()})

    @staticmethod
    def _validate(app: LoanApplication, cfg: ProductConfig) -> List[str]:
        w: List[str] = []
        if app.loan_amount <= 0:
            raise ValueError("loan_amount must be positive.")
        if app.tenor <= 0:
            raise ValueError("tenor (months) must be positive.")
        if app.origin not in (ORIGIN_BRANCH, ORIGIN_AGENT):
            raise ValueError(f"origin must be {ORIGIN_BRANCH} or {ORIGIN_AGENT}.")
        if app.channel not in (CHANNEL_BANK, CHANNEL_ECOCASH):
            raise ValueError(f"channel must be {CHANNEL_BANK} or {CHANNEL_ECOCASH}.")
        if app.loan_type not in (LOAN_NEW, LOAN_TOPUP):
            raise ValueError(f"loan_type must be {LOAN_NEW} or {LOAN_TOPUP}.")
        if app.interest_method and app.interest_method not in ("reducing_balance", "straight_line"):
            raise ValueError("interest_method must be 'reducing_balance' or 'straight_line'.")
        if app.tenor > max(cfg.insurance_table):
            w.append(f"Tenor {app.tenor} exceeds insurance table "
                     f"({max(cfg.insurance_table)} mths); rate extrapolated.")
        if app.loan_type == LOAN_TOPUP:
            if app.current_balance <= 0:
                w.append("TOP-UP with current_balance <= 0; treated as fresh advance.")
            if app.old_tenor and app.instalments_paid > app.old_tenor:
                w.append("instalments_paid exceeds old_tenor.")
        return w

    def _insurance_premium(self, app, cfg, gross_after_liq) -> Dict[str, float]:
        table = cfg.insurance_table
        current_rate = (cfg.insurance_rate_override if cfg.insurance_rate_override is not None
                        else insurance_rate(app.tenor, table))
        if app.loan_type == LOAN_NEW:
            base = gross_after_liq if cfg.charge_base == "gross_after_liquidation" else app.loan_amount
            prem = base * current_rate
            return {"net_premium": prem, "gross_premium": prem, "upr": 0.0,
                    "initial_premium": 0.0, "resultant_balance": base, "rate_used": current_rate}
        initial = app.original_loan * insurance_rate(app.old_tenor, table) if app.old_tenor else 0.0
        outstanding = (app.old_tenor - app.instalments_paid) if app.old_tenor else 0
        upr_term = outstanding - 1
        upr = app.current_balance * insurance_rate(upr_term, table) if upr_term >= 1 else 0.0
        if cfg.topup_model == "liquidation":
            resultant = app.current_balance + gross_after_liq
        else:
            resultant = app.current_balance + app.loan_amount
        gross = resultant * current_rate
        return {"net_premium": gross - upr, "gross_premium": gross, "upr": upr,
                "initial_premium": initial, "resultant_balance": resultant,
                "rate_used": current_rate}

    @staticmethod
    def _amortise(principal, rate, tenor, instalment, method="reducing_balance") -> List[Dict[str, float]]:
        sched, bal = [], principal
        straight_line = method == "straight_line"
        principal_per_period = (principal / tenor) if (straight_line and tenor) else None
        interest_per_period = principal * rate if straight_line else None
        for i in range(1, tenor + 1):
            interest = interest_per_period if straight_line else bal * rate
            principal_paid = principal_per_period if straight_line else instalment - interest
            bal_after = bal - principal_paid
            if i == tenor:
                principal_paid += bal_after
                bal_after = 0.0
            sched.append({"period": i, "opening_balance": round(bal, 2),
                          "instalment": round(instalment, 2), "interest": round(interest, 2),
                          "principal": round(principal_paid, 2),
                          "closing_balance": round(max(bal_after, 0.0), 2)})
            bal = bal_after
        return sched

    @staticmethod
    def _effective_apr(principal, instalment, tenor) -> float:
        if principal <= 0 or instalment <= 0:
            return 0.0
        lo, hi = 1e-9, 1.0
        def pv(r):
            return sum(instalment / (1 + r) ** t for t in range(1, tenor + 1)) - principal
        for _ in range(200):
            mid = (lo + hi) / 2
            if pv(mid) > 0:
                lo = mid
            else:
                hi = mid
        monthly = (lo + hi) / 2
        return round(((1 + monthly) ** 12 - 1) * 100, 4)

    def quote(self, app: LoanApplication, fx_rate=None, fx_currency=None) -> LoanQuote:
        if app.product_id not in self.configs:
            raise KeyError(f"Unknown product_id '{app.product_id}'.")
        cfg = self.configs[app.product_id]
        warnings = self._validate(app, cfg)

        if cfg.topup_model == "liquidation":
            gross_on_contract = app.loan_amount
            liquidated = app.current_balance if app.loan_type == LOAN_TOPUP else 0.0
            gross_after_liq = gross_on_contract - liquidated
        else:
            add_bal = app.current_balance if app.loan_type == LOAN_TOPUP else 0.0
            gross_on_contract = app.loan_amount + add_bal
            gross_after_liq = app.loan_amount

        bases = {"loan_amount": app.loan_amount, "gross_on_contract": gross_on_contract,
                 "gross_after_liquidation": gross_after_liq}
        ins = self._insurance_premium(app, cfg, gross_after_liq)
        ctx = {"origin": app.origin, "channel": app.channel, "bases": bases,
               "insurance_premium": ins["net_premium"]}

        charge_lines, total_charges = {}, 0.0
        for comp in cfg.charges:
            val = comp.resolve(ctx)
            charge_lines[comp.label] = round(val, 5)
            if comp.include_in_total:
                total_charges += val

        net_loan = bases[cfg.charge_base] - total_charges
        rate = cfg.interest.resolve(app.tenor, app.interest_rate)
        interest_method = app.interest_method or cfg.interest_method
        pmt_principal = bases[cfg.pmt_base]
        if interest_method == "straight_line":
            instalment = (pmt_principal / app.tenor) + pmt_principal * rate if app.tenor else 0.0
        else:
            instalment = pmt(rate, app.tenor, -pmt_principal)
        if cfg.pmt_round is not None:
            instalment = round(instalment, cfg.pmt_round)

        das = cfg.das_commission_rate
        if cfg.das_method == "grossup":
            das_commission = instalment * (das / (1 - das)) if das < 1 else 0.0
        else:
            das_commission = instalment * das
        total_instalment = instalment + das_commission

        app_date = app.application_date or date.today()
        start, end = instalment_dates(app_date, app.tenor, cfg.start_offset_months)

        amort = self._amortise(pmt_principal, rate, app.tenor, instalment, method=interest_method)
        total_repayable = round(instalment * app.tenor, 2)
        total_interest = round(total_repayable - pmt_principal, 2)
        total_cost_of_credit = round(total_charges + total_interest, 2)
        apr = self._effective_apr(pmt_principal, instalment, app.tenor)

        fx = None
        if fx_rate and fx_currency:
            fx = {"currency": fx_currency, "rate": fx_rate,
                  "net_loan": round(net_loan * fx_rate, 2),
                  "total_instalment": round(total_instalment * fx_rate, 2),
                  "total_charges": round(total_charges * fx_rate, 2),
                  "total_repayable": round(total_repayable * fx_rate, 2),
                  "total_interest": round(total_interest * fx_rate, 2),
                  "total_cost_of_credit": round(total_cost_of_credit * fx_rate, 2)}

        return LoanQuote(
            product_id=cfg.id, product_name=cfg.name, currency=cfg.currency,
            portfolio=cfg.portfolio, loan_type=app.loan_type, origin=app.origin,
            channel=app.channel, tenor=app.tenor, interest_rate=rate,
            interest_method=interest_method,
            gross_loan_on_contract=round(gross_on_contract, 2),
            gross_loan_after_liquidation=round(gross_after_liq, 2),
            charges=charge_lines, total_charges=round(total_charges, 2),
            net_loan=round(net_loan, 2), indicative_instalment=round(instalment, 2),
            das_commission=round(das_commission, 2), total_instalment=round(total_instalment, 2),
            insurance_breakdown={k: round(v, 5) for k, v in ins.items()},
            expected_instalment_start=start.isoformat(),
            expected_instalment_end=end.isoformat(),
            total_repayable=total_repayable, total_interest=total_interest,
            total_cost_of_credit=total_cost_of_credit,
            effective_apr=apr, amortisation=amort, warnings=warnings, fx=fx)

    def compare(self, base_app, variants) -> Dict[str, LoanQuote]:
        out = {}
        for label, overrides in variants.items():
            d = base_app.to_dict(); d.update(overrides)
            out[label] = self.quote(LoanApplication.from_dict(d))
        return out


# =====================================================================
# BUILT-IN CONFIGS (one per uploaded workbook + portfolio variants)
# =====================================================================
DAS_BY_PORTFOLIO = {"SSB": 0.03, "TERTIARY": 0.025, "CORPORATE": 0.025,
                    "PENSIONS": 0.05, "SME": 0.0}


def _channel_bank_and_immt_charges(immt_rate=0.02, base="loan_amount"):
    """BANK: flat $10 + IMMT at immt_rate. ECOCASH: flat $0.50, no IMMT."""
    return [
        ChargeComponent("bank_charge", "BANK/ECOCASH CHARGES", "flat_by_channel",
                        amount={CHANNEL_BANK: 10.0, CHANNEL_ECOCASH: 0.5}),
        ChargeComponent("immt", "IMMT", "pct_by_channel",
                        rate={CHANNEL_BANK: immt_rate, CHANNEL_ECOCASH: 0.0}, base=base),
    ]


def _newer_charges(est_rate, include_bank_and_immt=False):
    kind = "pct_by_channel" if isinstance(est_rate, dict) else "pct"
    charges = [
        ChargeComponent("establishment", "ESTABLISHMENT FEES", kind, rate=est_rate,
                        base="gross_after_liquidation"),
    ]
    if include_bank_and_immt:
        charges += _channel_bank_and_immt_charges(base="gross_after_liquidation")
    charges += [
        ChargeComponent("insurance", "INSURANCE", "insurance", base="gross_after_liquidation"),
        ChargeComponent("agent_commission", "AGENT COMMISSION", "pct", rate=0.02,
                        base="gross_after_liquidation", origin_gate=ORIGIN_AGENT),
    ]
    return charges


def usd_v6(portfolio="SSB"):
    return ProductConfig(
        id=f"USD_{portfolio}", name=f"USD Loans Calculator ({portfolio})",
        currency="USD", portfolio=portfolio, interest=InterestRule(mode="input"),
        das_commission_rate=DAS_BY_PORTFOLIO.get(portfolio, 0.03), das_method="grossup",
        charge_base="gross_after_liquidation", topup_model="liquidation",
        pmt_base="gross_on_contract", pmt_round=0,
        charges=_newer_charges({CHANNEL_BANK: 0.07, CHANNEL_ECOCASH: 0.056},
                               include_bank_and_immt=(portfolio != "SSB")),
        version="v6.2026.1", notes="Est 7% bank / 5.6% ecocash of gross-after-liquidation.")


def zwg_v6(portfolio="SSB"):
    return ProductConfig(
        id=f"ZWG_{portfolio}", name=f"ZiG Loans Calculator ({portfolio})",
        currency="ZiG", portfolio=portfolio, interest=InterestRule(mode="input", default_rate=0.08),
        das_commission_rate=DAS_BY_PORTFOLIO.get(portfolio, 0.03), das_method="grossup",
        charge_base="gross_after_liquidation", topup_model="liquidation",
        pmt_base="gross_on_contract", pmt_round=0,
        charges=_newer_charges(0.07, include_bank_and_immt=(portfolio != "SSB")),
        version="v6.2026.1", notes="Est flat 7% of gross-after-liquidation. Rate input, default 8%.")


def presidential_office_zwg():
    """Inherits all ZiG Corporate characteristics except D.A.S, which is 2.5%."""
    cfg = zwg_v6("CORPORATE")
    cfg.id = "ZWG_PRESIDENTIAL_OFFICE"
    cfg.name = "Presidential Office Loan (ZiG)"
    cfg.portfolio = "PRESIDENTIAL_OFFICE"
    cfg.das_commission_rate = 0.025
    cfg.notes = "Inherits ZiG Corporate characteristics; D.A.S fixed at 2.5%."
    return cfg


def sme_usd():
    return ProductConfig(
        id="SME_USD", name="SME USD Calculator", currency="USD", portfolio="SME",
        interest=InterestRule(mode="input", default_rate=0.10), das_commission_rate=0.0,
        das_method="grossup", charge_base="loan_amount", topup_model="additive",
        pmt_base="gross_on_contract", pmt_round=None,
        charges=[ChargeComponent("establishment", "ESTABLISHMENT FEES", "pct", rate=0.02, base="loan_amount"),
                 *_channel_bank_and_immt_charges(),
                 ChargeComponent("insurance", "INSURANCE", "insurance", base="loan_amount")],
        version="v2.9.7", notes="Est 2%, bank charge 10 (0.50 EcoCash), IMMT 2% (0 EcoCash). "
                                 "Rate input, default 10%.")


def ssb_calculator():
    return ProductConfig(
        id="SSB", name="SSB Calculator (with agent commission)", currency="USD", portfolio="SSB",
        interest=InterestRule(mode="fixed", value=0.08), das_commission_rate=0.03,
        das_method="grossup", charge_base="loan_amount", topup_model="additive",
        pmt_base="gross_on_contract", pmt_round=None,
        charges=[ChargeComponent("establishment", "ESTABLISHMENT FEES", "pct", rate=0.04, base="loan_amount"),
                 *_channel_bank_and_immt_charges(),
                 ChargeComponent("insurance", "INSURANCE", "insurance", base="loan_amount"),
                 ChargeComponent("agent_commission", "AGENT COMMISSION", "pct", rate=0.02,
                                 base="loan_amount", origin_gate=ORIGIN_AGENT)],
        version="v2.9.8", notes="Est 4%, bank charge 10 (0.50 EcoCash), IMMT 2% (0 EcoCash).")


def tertiary():
    return ProductConfig(
        id="TERTIARY", name="Tertiary Calculator", currency="USD", portfolio="TERTIARY",
        interest=InterestRule(mode="tiered", low=0.07, high=0.07, threshold=17),
        das_commission_rate=0.02041, das_method="simple", charge_base="loan_amount",
        topup_model="additive", pmt_base="gross_on_contract", pmt_round=None,
        charges=[ChargeComponent("establishment", "ESTABLISHMENT FEES", "pct", rate=0.04, base="loan_amount"),
                 *_channel_bank_and_immt_charges(),
                 ChargeComponent("insurance", "INSURANCE", "insurance", base="loan_amount"),
                 ChargeComponent("agent_commission", "AGENT COMMISSION", "pct", rate=0.02,
                                 base="loan_amount", origin_gate=ORIGIN_AGENT)],
        version="v3", notes="Portfolio-rate driven; DAS simple (rate pre-grossed 0.02041).")


def ecocash_2025():
    return ProductConfig(
        id="ECOCASH_2025", name="2025 Charges Calculator (EcoCash)", currency="USD", portfolio="SSB",
        interest=InterestRule(mode="fixed", value=0.08), das_commission_rate=0.03,
        das_method="grossup", charge_base="loan_amount", topup_model="additive",
        pmt_base="gross_on_contract", pmt_round=None,
        charges=[ChargeComponent("establishment", "ESTABLISHMENT FEES", "pct", rate=0.04, base="loan_amount"),
                 *_channel_bank_and_immt_charges(),
                 ChargeComponent("insurance", "INSURANCE", "insurance", base="loan_amount"),
                 ChargeComponent("agent_commission", "AGENT COMMISSION", "pct", rate=0.02,
                                 base="loan_amount", origin_gate=ORIGIN_AGENT)],
        version="v3.0.0", notes="EcoCash-aware channel charge and IMMT.")


def build_default_configs():
    cfgs = [usd_v6("SSB"), zwg_v6("SSB"), sme_usd(), ssb_calculator(), tertiary(), ecocash_2025(),
            presidential_office_zwg()]
    for p in ("TERTIARY", "CORPORATE", "PENSIONS"):
        cfgs += [usd_v6(p), zwg_v6(p)]
    return cfgs


def default_engine() -> LoanChargesEngine:
    eng = LoanChargesEngine()
    for c in build_default_configs():
        eng.register(c)
    return eng


# =====================================================================
# CLIENT QUOTE + OFFER
# =====================================================================
@dataclass
class Client:
    full_name: str
    national_id: str = ""
    phone: str = ""
    employer: str = ""
    client_ref: str = ""

    def to_dict(self):
        return asdict(self)


def quote_for_client(client: Client, application: LoanApplication,
                     engine: Optional[LoanChargesEngine] = None,
                     officer: str = "", **kw) -> Dict[str, Any]:
    engine = engine or default_engine()
    q = engine.quote(application, **kw)
    return {"quote_id": str(uuid.uuid4())[:8].upper(),
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "officer": officer, "client": client.to_dict(),
            "application": application.to_dict(), "quote": q.to_dict()}


def offer_summary(record: Dict[str, Any]) -> str:
    c, a, q = record["client"], record["application"], record["quote"]
    cur = q["currency"]
    L = ["FIRST MUTUAL MICROFINANCE — INDICATIVE LOAN OFFER",
         f"Quote ref: {record['quote_id']}      Date: {record['generated_at'][:10]}",
         "-" * 52,
         f"Client   : {c['full_name']}" + (f"   (ID: {c['national_id']})" if c.get("national_id") else ""),
         f"Product  : {q['product_name']}  [{q['loan_type']}, {q['origin']}]",
         f"Amount   : {cur} {a['loan_amount']:,.2f}   Tenor: {q['tenor']} months"
         f"   Rate: {q['interest_rate']*100:.2f}%/month", "-" * 52]
    for label, val in q["charges"].items():
        L.append(f"  {label:<28} {cur} {val:>12,.2f}")
    L += [f"  {'TOTAL CHARGES':<28} {cur} {q['total_charges']:>12,.2f}", "-" * 52,
          f"  {'NET AMOUNT DISBURSED':<28} {cur} {q['net_loan']:>12,.2f}",
          f"  {'MONTHLY INSTALMENT':<28} {cur} {q['total_instalment']:>12,.2f}",
          f"  {'TOTAL REPAYABLE':<28} {cur} {q['total_repayable']:>12,.2f}",
          f"  {'EFFECTIVE APR':<28} {q['effective_apr']:>15.2f}%", "-" * 52,
          f"  First instalment: {q['expected_instalment_start']}    Final: {q['expected_instalment_end']}",
          "", "Indicative only. Subject to credit approval and affordability checks."]
    return "\n".join(L)


# =====================================================================
# INTERACTIVE CLI
# =====================================================================
def _quit(v):
    if str(v).strip().lower() in ("q", "quit", "exit"):
        print("Cancelled."); raise SystemExit(0)


def ask(prompt, default=None, cast=str):
    while True:
        d = f" [{default}]" if default is not None else ""
        raw = input(f"{prompt}{d}: ").strip(); _quit(raw)
        if raw == "" and default is not None:
            return default
        if raw == "":
            print("  (required)"); continue
        try:
            return cast(raw)
        except (ValueError, TypeError):
            print("  invalid — try again")


def ask_choice(prompt, options, default=None):
    up = [o.upper() for o in options]
    while True:
        d = f" [{default}]" if default else ""
        raw = input(f"{prompt} ({'/'.join(options)}){d}: ").strip(); _quit(raw)
        if raw == "" and default:
            return default
        if raw.upper() in up:
            return options[up.index(raw.upper())]
        print("  choose one of:", ", ".join(options))


def pick_product(eng):
    products = eng.list_products()
    print("\nAvailable calculators:")
    for i, p in enumerate(products, 1):
        print(f"  {i:>2}. {p['id']:<14} {p['currency']:<4} {p['portfolio']:<10} {p['name']}")
    while True:
        raw = input("\nPick a calculator (number or id): ").strip(); _quit(raw)
        if raw.isdigit() and 1 <= int(raw) <= len(products):
            return products[int(raw) - 1]["id"]
        ids = {p["id"].upper(): p["id"] for p in products}
        if raw.upper() in ids:
            return ids[raw.upper()]
        print("  not found — enter a number from the list or an exact id")


def run_one(eng):
    product_id = pick_product(eng)
    cfg = eng.configs[product_id]
    print(f"\nEntering details for: {cfg.name} ({cfg.currency})")
    client_name = ask("Client name", default="Walk-in client")
    loan_type = ask_choice("Loan type", ["NEW", "TOP-UP"], default="NEW")
    amt_label = "Top-up amount" if loan_type == "TOP-UP" else "Loan amount"
    loan_amount = ask(f"{amt_label} ({cfg.currency})", cast=float)
    tenor = ask("Tenor (months)", cast=int)
    origin = ask_choice("Loan origination", ["BRANCH", "AGENT"], default="BRANCH")
    channel = ask_choice("Disbursement channel", ["BANK", "ECOCASH"], default="BANK")
    interest_rate = None
    if cfg.interest.mode == "input":
        interest_rate = ask("Interest rate (monthly, e.g. 0.08 = 8%)", default=0.08, cast=float)
    kw = dict(product_id=product_id, loan_amount=loan_amount, tenor=tenor, origin=origin,
              channel=channel, loan_type=loan_type, interest_rate=interest_rate,
              application_date=date.today())
    if loan_type == "TOP-UP":
        print("\nTop-up details (client's existing loan):")
        kw["original_loan"] = ask("  Original loan amount", default=0.0, cast=float)
        kw["old_tenor"] = ask("  Original tenor (months)", default=0, cast=int)
        kw["current_balance"] = ask("  Current outstanding balance", default=0.0, cast=float)
        kw["instalments_paid"] = ask("  Instalments already paid", default=0, cast=int)
    try:
        record = quote_for_client(Client(full_name=client_name), LoanApplication(**kw), engine=eng)
    except (ValueError, KeyError) as e:
        print(f"\n!! Could not produce a quote: {e}"); return
    print("\n" + offer_summary(record))
    if record["quote"]["warnings"]:
        print("\nNotes:")
        for w in record["quote"]["warnings"]:
            print("  -", w)
    if ask_choice("\nShow full amortisation schedule?", ["Y", "N"], default="N") == "Y":
        print(f"\n  {'#':>3} {'opening':>11} {'instal':>9} {'interest':>9} {'principal':>10} {'closing':>11}")
        for r in record["quote"]["amortisation"]:
            print(f"  {r['period']:>3} {r['opening_balance']:>11,.2f} {r['instalment']:>9,.2f} "
                  f"{r['interest']:>9,.2f} {r['principal']:>10,.2f} {r['closing_balance']:>11,.2f}")
    if ask_choice("\nSave this quote to a JSON file?", ["Y", "N"], default="N") == "Y":
        fname = f"quote_{record['quote_id']}.json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, default=str)
        print(f"  Saved: {fname}")


def interactive():
    eng = default_engine()
    print("=" * 56)
    print("  FMM LOAN CHARGES CALCULATOR")
    print("=" * 56)
    while True:
        run_one(eng)
        if ask_choice("\nQuote another client?", ["Y", "N"], default="Y") == "N":
            break
    print("\nGoodbye.")


# =====================================================================
# SELF-TEST (validates against original workbook figures)
# =====================================================================
def self_test() -> int:
    eng = default_engine()
    def near(a, b, t=0.05):
        return abs(a - b) <= t
    def ch(q, needle):
        for k, v in q.charges.items():
            if needle.lower() in k.lower():
                return v
        return None
    cases = [
        ("ZWG v6", dict(product_id="ZWG_SSB", loan_amount=10000, tenor=12, origin="AGENT",
                        channel="BANK", loan_type="TOP-UP", interest_rate=0.08, current_balance=0,
                        application_date=date(2026, 6, 3)),
         dict(total_charges=1020.0, net=8980.0, instal=1327.0, total_instal=1368.04,
              start="2026-07-01", end="2027-06-30")),
        ("USD v6", dict(product_id="USD_SSB", loan_amount=6000, tenor=24, origin="AGENT",
                        channel="ECOCASH", loan_type="TOP-UP", interest_rate=0.08, current_balance=0,
                        application_date=date(2026, 7, 3)),
         dict(total_charges=578.4, net=5421.6, instal=570.0, total_instal=587.63)),
        ("TERTIARY", dict(product_id="TERTIARY", loan_amount=2200, tenor=24, origin="BRANCH",
                          loan_type="NEW", application_date=date(2025, 3, 24)),
         dict(total_charges=186.88, net=2013.12, instal=191.82, total_instal=195.73)),
        ("SME_USD", dict(product_id="SME_USD", loan_amount=2000, tenor=6, origin="BRANCH",
                         loan_type="NEW", interest_rate=0.07),
         dict(total_charges=102.0, net=1898.0, instal=419.59, total_instal=419.59)),
        ("SME_USD default rate", dict(product_id="SME_USD", loan_amount=2000, tenor=6, origin="BRANCH",
                                      loan_type="NEW"),
         dict(total_charges=102.0, net=1898.0, instal=459.21, total_instal=459.21)),
        ("SSB", dict(product_id="SSB", loan_amount=420, tenor=24, origin="BRANCH", loan_type="TOP-UP",
                     original_loan=1000, old_tenor=24, current_balance=924.35, instalments_paid=9),
         dict(total_charges=50.24, net=369.76, instal=127.68, total_instal=131.63)),
        ("ECOCASH_2025", dict(product_id="ECOCASH_2025", loan_amount=1000, tenor=24, origin="AGENT",
                              channel="ECOCASH", loan_type="NEW", application_date=date(2025, 4, 3)),
         dict(total_charges=80.9, net=919.1, instal=94.98, total_instal=97.92,
              start="2025-05-01", end="2027-04-30")),
        ("Presidential Office ZWG", dict(product_id="ZWG_PRESIDENTIAL_OFFICE", loan_amount=10000,
                                        tenor=12, origin="BRANCH", loan_type="NEW"),
         dict(total_charges=None, net=None, instal=None, total_instal=None, das_rate=0.025,
              rate=0.08)),
        ("Straight line", dict(product_id="SME_USD", loan_amount=1200, tenor=12, origin="BRANCH",
                               loan_type="NEW", interest_rate=0.05, interest_method="straight_line"),
         dict(total_charges=None, net=None, instal=(1200 / 12 + 1200 * 0.05), total_instal=None)),
    ]
    fails = 0
    for label, app_kw, exp in cases:
        q = eng.quote(LoanApplication(**app_kw))
        checks = [("total_charges", q.total_charges, exp["total_charges"]),
                  ("net_loan", q.net_loan, exp["net"]),
                  ("instalment", q.indicative_instalment, exp["instal"]),
                  ("total_instalment", q.total_instalment, exp["total_instal"])]
        if "start" in exp:
            checks.append(("instal_start", q.expected_instalment_start, exp["start"]))
            checks.append(("instal_end", q.expected_instalment_end, exp["end"]))
        if "das_rate" in exp:
            checks.append(("das_rate", eng.configs[app_kw["product_id"]].das_commission_rate, exp["das_rate"]))
        if "rate" in exp:
            checks.append(("interest_rate", q.interest_rate, exp["rate"]))
        if app_kw.get("interest_method") == "straight_line":
            interests = {r["interest"] for r in q.amortisation[:-1]}
            checks.append(("straight_line_flat_interest", len(interests), 1))
        ok_all = True
        for name, got, want in checks:
            if want is None:
                continue
            ok = near(got, want) if isinstance(want, (int, float)) else got == want
            if not ok:
                ok_all = False; fails += 1
                print(f"  XX {label}.{name}: got {got} expected {want}")
        print(f"[{'PASS' if ok_all else 'FAIL'}] {label}")

    for product_id in ("SME_USD", "SSB", "TERTIARY", "ECOCASH_2025", "USD_TERTIARY", "ZWG_TERTIARY",
                      "USD_CORPORATE", "ZWG_CORPORATE", "USD_PENSIONS", "ZWG_PENSIONS"):
        q = eng.quote(LoanApplication(product_id=product_id, loan_amount=1000, tenor=12,
                                       origin="BRANCH", loan_type="NEW", channel="ECOCASH",
                                       interest_rate=0.08))
        bank = ch(q, "BANK") or ch(q, "CHARGE")
        immt = ch(q, "IMMT")
        ok = near(bank, 0.5) and (immt is None or near(immt, 0.0))
        if not ok:
            ok = False; fails += 1
            print(f"  XX {product_id}.ecocash_charges: bank={bank} immt={immt} (want bank=0.50, immt=0)")
        print(f"[{'PASS' if ok else 'FAIL'}] {product_id} EcoCash channel charges")

    for product_id in ("USD_SSB", "ZWG_SSB"):
        q = eng.quote(LoanApplication(product_id=product_id, loan_amount=1000, tenor=12,
                                       origin="BRANCH", loan_type="NEW", channel="BANK",
                                       interest_rate=0.08))
        has_bank_or_immt = ch(q, "BANK") is not None or ch(q, "IMMT") is not None
        ok = not has_bank_or_immt
        if not ok:
            ok = False; fails += 1
            print(f"  XX {product_id}.no_bank_immt: unexpectedly has bank/immt charges: {q.charges}")
        print(f"[{'PASS' if ok else 'FAIL'}] {product_id} has no Bank/IMMT (unchanged)")

    eng_override = default_engine()
    eng_override.configs["SME_USD"].insurance_rate_override = 0.05
    q = eng_override.quote(LoanApplication(product_id="SME_USD", loan_amount=1000, tenor=12,
                                           origin="BRANCH", loan_type="NEW", interest_rate=0.08))
    ok = near(q.insurance_breakdown["rate_used"], 0.05) and near(ch(q, "INSURANCE"), 50.0)
    if not ok:
        fails += 1
        print(f"  XX insurance_rate_override: rate_used={q.insurance_breakdown['rate_used']} "
              f"insurance_charge={ch(q, 'INSURANCE')} (want rate=0.05, charge=50.00)")
    print(f"[{'PASS' if ok else 'FAIL'}] insurance_rate_override")

    print("=" * 40)
    print("ALL PASS" if fails == 0 else f"{fails} CHECK(S) FAILED")
    return 0 if fails == 0 else 1


# =====================================================================
# ENTRY POINT
# =====================================================================
def main():
    args = sys.argv[1:]
    if "--test" in args:
        raise SystemExit(self_test())
    if "--list" in args:
        for p in default_engine().list_products():
            print(f"{p['id']:<14} {p['currency']:<4} {p['portfolio']:<10} {p['name']}")
        return
    if "--help" in args or "-h" in args:
        print(__doc__); return
    try:
        interactive()
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled.")


if __name__ == "__main__":
    main()
