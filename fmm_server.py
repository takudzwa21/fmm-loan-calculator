#!/usr/bin/env python3
"""
FMM LOAN CHARGES ENGINE — local REST API server
================================================

Wraps fmm_calculator.py's LoanChargesEngine in the small HTTP API the
front-end (src/lib/engine.ts) already expects — no framework, no installs,
just the standard library, matching fmm_calculator.py's own philosophy.

    python fmm_server.py                # serve on 127.0.0.1:8000
    python fmm_server.py --port 8080
    python fmm_server.py --host 0.0.0.0 --port 8000

Built-in products live only in code (fmm_calculator.py). Anything created
through POST /products, and every quote calculated through POST /quote, is
persisted to JSON files under ./.fmm_data/ so it survives a server restart.

Endpoints (see README.md §4 for the full contract):
    GET    /products
    GET    /products/{id}
    POST   /products                create a product, optionally inheriting
                                     from an existing one via "inherit_from"
    DELETE /products/{id}           custom products only

    POST   /quote                   calculate a quote; auto-saves to history
    GET    /quotes                  list history (?q=&sort=&order=&limit=)
    GET    /quotes/{id}
    PUT    /quotes/{id}             edit inputs and recalculate
    DELETE /quotes/{id}
"""
from __future__ import annotations

import argparse
import json
import threading
import uuid
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from fmm_calculator import LoanApplication, ProductConfig, add_months, default_engine

DATA_DIR = Path(__file__).resolve().parent / ".fmm_data"
PRODUCTS_FILE = DATA_DIR / "products.json"
QUOTES_FILE = DATA_DIR / "quotes.json"

engine = default_engine()
BUILT_IN_PRODUCT_IDS = frozenset(engine.configs.keys())
_lock = threading.Lock()


class JsonListStore:
    """A tiny JSON-file-backed list of records, keyed by 'id'. Not for high concurrency."""

    def __init__(self, path: Path):
        self.path = path
        self._records: list[dict] = []
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                self._records = json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self._records = []

    def _save(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._records, indent=2, default=str), encoding="utf-8")

    def all(self) -> list[dict]:
        return list(self._records)

    def get(self, record_id: str) -> dict | None:
        return next((r for r in self._records if r["id"] == record_id), None)

    def upsert(self, record: dict) -> None:
        for i, r in enumerate(self._records):
            if r["id"] == record["id"]:
                self._records[i] = record
                self._save()
                return
        self._records.append(record)
        self._save()

    def delete(self, record_id: str) -> bool:
        before = len(self._records)
        self._records = [r for r in self._records if r["id"] != record_id]
        if len(self._records) != before:
            self._save()
            return True
        return False

    def delete_where(self, predicate) -> int:
        before = len(self._records)
        self._records = [r for r in self._records if not predicate(r)]
        removed = before - len(self._records)
        if removed:
            self._save()
        return removed


products_store = JsonListStore(PRODUCTS_FILE)
quotes_store = JsonListStore(QUOTES_FILE)

# Quote history is transactional and ages out; product definitions are configuration
# and never auto-expire. 0 disables auto-clearing.
QUOTE_RETENTION_MONTHS = 3


def purge_expired_quotes() -> int:
    if QUOTE_RETENTION_MONTHS <= 0:
        return 0
    cutoff = add_months(date.today(), -QUOTE_RETENTION_MONTHS).isoformat()
    with _lock:
        removed = quotes_store.delete_where(lambda r: r.get("created_at", "9999-99-99")[:10] < cutoff)
    if removed:
        print(f"Purged {removed} quote(s) older than {QUOTE_RETENTION_MONTHS} month(s) "
              f"(cutoff {cutoff}).")
    return removed

for _rec in products_store.all():
    try:
        engine.register(ProductConfig.from_dict(_rec))
    except (TypeError, ValueError) as e:
        print(f"Skipping stored product '{_rec.get('id')}': {e}")


def _merge_product_dict(base: dict, overrides: dict) -> dict:
    merged = dict(base)
    for key, value in overrides.items():
        if key == "interest" and isinstance(value, dict) and isinstance(merged.get("interest"), dict):
            merged["interest"] = {**merged["interest"], **value}
        elif value is not None:
            merged[key] = value
    return merged


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def _send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_detail(self, status: int, detail: str) -> None:
        self._send_json(status, {"detail": detail})

    def _read_json_body(self) -> object:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ---------------------------------------------------------------
    # GET
    # ---------------------------------------------------------------
    def do_GET(self) -> None:
        split = urlsplit(self.path)
        path = split.path.rstrip("/") or "/"
        qs = parse_qs(split.query)

        if path == "/products":
            out = []
            for p in engine.list_products():
                out.append({**p, "custom": p["id"] not in BUILT_IN_PRODUCT_IDS})
            return self._send_json(200, out)

        if path.startswith("/products/"):
            product_id = path[len("/products/"):]
            cfg = engine.configs.get(product_id)
            if cfg is None:
                return self._send_error_detail(404, f"Unknown product_id '{product_id}'.")
            return self._send_json(200, cfg.to_dict())

        if path == "/quotes":
            return self._list_quotes(qs)

        if path.startswith("/quotes/"):
            record = quotes_store.get(path[len("/quotes/"):])
            if record is None:
                return self._send_error_detail(404, "Quote not found.")
            return self._send_json(200, record)

        return self._send_error_detail(404, f"Not found: {path}")

    def _list_quotes(self, qs: dict) -> None:
        purge_expired_quotes()
        records = quotes_store.all()
        q = (qs.get("q", [""])[0] or "").strip().lower()
        if q:
            def matches(r):
                haystack = " ".join([
                    str(r.get("client_name", "")), str(r.get("officer", "")),
                    str(r.get("product_name", "")), str(r.get("quote_ref", "")),
                ]).lower()
                return q in haystack
            records = [r for r in records if matches(r)]

        sort_key = qs.get("sort", ["created_at"])[0]
        order = qs.get("order", ["desc"])[0]
        records.sort(key=lambda r: (r.get(sort_key) is None, r.get(sort_key)),
                     reverse=(order == "desc"))

        limit = qs.get("limit", [None])[0]
        if limit:
            records = records[: int(limit)]

        summary = [{
            "id": r["id"], "created_at": r["created_at"], "updated_at": r.get("updated_at"),
            "quote_ref": r.get("quote_ref"), "client_name": r.get("client_name"),
            "officer": r.get("officer"), "product_id": r["quote"]["product_id"],
            "product_name": r["quote"]["product_name"], "currency": r["quote"]["currency"],
            "loan_type": r["quote"]["loan_type"], "tenor": r["quote"]["tenor"],
            "net_loan": r["quote"]["net_loan"], "total_instalment": r["quote"]["total_instalment"],
        } for r in records]
        self._send_json(200, summary)

    # ---------------------------------------------------------------
    # POST
    # ---------------------------------------------------------------
    def do_POST(self) -> None:
        path = urlsplit(self.path).path.rstrip("/") or "/"
        try:
            body = self._read_json_body()
        except json.JSONDecodeError:
            return self._send_error_detail(400, "Request body is not valid JSON.")

        if path == "/quote":
            return self._create_quote(body)
        if path == "/products":
            return self._create_product(body)
        return self._send_error_detail(404, f"Not found: {path}")

    def _create_quote(self, body: dict) -> None:
        purge_expired_quotes()
        payload = body.get("payload")
        if not isinstance(payload, dict):
            return self._send_error_detail(400, "Missing 'payload' object in request body.")

        try:
            app = LoanApplication.from_dict(payload)
            quote = engine.quote(app, fx_rate=body.get("fx_rate"), fx_currency=body.get("fx_currency"))
        except KeyError as e:
            return self._send_error_detail(400, e.args[0] if e.args else str(e))
        except (ValueError, TypeError) as e:
            return self._send_error_detail(400, str(e))
        except Exception as e:  # unexpected engine failure
            return self._send_error_detail(500, f"Engine error: {e}")

        client = body.get("client") or {}
        now = datetime.now().isoformat(timespec="seconds")
        with _lock:
            record = {
                "id": str(uuid.uuid4()), "created_at": now, "updated_at": now,
                "quote_ref": body.get("quote_ref"),
                "client_name": client.get("full_name") or client.get("client_name") or "",
                "officer": client.get("officer") or "",
                "application": app.to_dict(),
                "fx_rate": body.get("fx_rate"), "fx_currency": body.get("fx_currency"),
                "quote": quote.to_dict(),
            }
            quotes_store.upsert(record)

        return self._send_json(200, quote.to_dict())

    def _create_product(self, body: dict) -> None:
        inherit_from = body.get("inherit_from")
        overrides = {k: v for k, v in body.items() if k != "inherit_from"}

        if inherit_from:
            base_cfg = engine.configs.get(inherit_from)
            if base_cfg is None:
                return self._send_error_detail(400, f"Unknown inherit_from product '{inherit_from}'.")
            base_dict = base_cfg.to_dict()
            base_dict.pop("id", None)  # never silently inherit the base product's id
            merged = _merge_product_dict(base_dict, overrides)
        else:
            required = {"name", "currency", "portfolio"}
            missing = required - overrides.keys()
            if missing:
                return self._send_error_detail(
                    400, f"Missing required field(s) for a new product: {', '.join(sorted(missing))}.")
            merged = overrides

        if not merged.get("id"):
            slug = "".join(c if c.isalnum() else "_" for c in merged["name"].upper()).strip("_")
            candidate, n = slug, 2
            while candidate in engine.configs:
                candidate = f"{slug}_{n}"
                n += 1
            merged["id"] = candidate
        elif merged["id"] in BUILT_IN_PRODUCT_IDS:
            return self._send_error_detail(
                400, f"'{merged['id']}' is a built-in product id and cannot be overwritten. "
                     "Choose a different id.")

        try:
            cfg = ProductConfig.from_dict(merged)
        except (TypeError, ValueError) as e:
            return self._send_error_detail(400, f"Invalid product definition: {e}")

        with _lock:
            engine.register(cfg)
            products_store.upsert(cfg.to_dict())

        return self._send_json(201, {**cfg.to_dict(), "custom": True})

    def _update_product(self, product_id: str) -> None:
        existing_cfg = engine.configs.get(product_id)
        if existing_cfg is None:
            return self._send_error_detail(404, f"Unknown product_id '{product_id}'.")

        try:
            body = self._read_json_body()
        except json.JSONDecodeError:
            return self._send_error_detail(400, "Request body is not valid JSON.")

        overrides = {k: v for k, v in body.items() if k != "id"}
        merged = _merge_product_dict(existing_cfg.to_dict(), overrides)
        merged["id"] = product_id  # editing never changes the id

        try:
            cfg = ProductConfig.from_dict(merged)
        except (TypeError, ValueError) as e:
            return self._send_error_detail(400, f"Invalid product definition: {e}")

        with _lock:
            engine.register(cfg)
            products_store.upsert(cfg.to_dict())

        return self._send_json(200, {**cfg.to_dict(), "custom": product_id not in BUILT_IN_PRODUCT_IDS})

    # ---------------------------------------------------------------
    # PUT
    # ---------------------------------------------------------------
    def do_PUT(self) -> None:
        path = urlsplit(self.path).path.rstrip("/") or "/"
        if path.startswith("/products/"):
            return self._update_product(path[len("/products/"):])
        if not path.startswith("/quotes/"):
            return self._send_error_detail(404, f"Not found: {path}")

        record_id = path[len("/quotes/"):]
        existing = quotes_store.get(record_id)
        if existing is None:
            return self._send_error_detail(404, "Quote not found.")

        try:
            body = self._read_json_body()
        except json.JSONDecodeError:
            return self._send_error_detail(400, "Request body is not valid JSON.")

        payload = body.get("payload", existing["application"])
        try:
            app = LoanApplication.from_dict(payload)
            fx_rate = body.get("fx_rate", existing.get("fx_rate"))
            fx_currency = body.get("fx_currency", existing.get("fx_currency"))
            quote = engine.quote(app, fx_rate=fx_rate, fx_currency=fx_currency)
        except KeyError as e:
            return self._send_error_detail(400, e.args[0] if e.args else str(e))
        except (ValueError, TypeError) as e:
            return self._send_error_detail(400, str(e))
        except Exception as e:
            return self._send_error_detail(500, f"Engine error: {e}")

        client = body.get("client") or {}
        with _lock:
            updated = {
                **existing,
                "updated_at": datetime.now().isoformat(timespec="seconds"),
                "quote_ref": body.get("quote_ref", existing.get("quote_ref")),
                "client_name": client.get("full_name", existing.get("client_name", "")),
                "officer": client.get("officer", existing.get("officer", "")),
                "application": app.to_dict(),
                "fx_rate": fx_rate, "fx_currency": fx_currency,
                "quote": quote.to_dict(),
            }
            quotes_store.upsert(updated)

        return self._send_json(200, updated)

    # ---------------------------------------------------------------
    # DELETE
    # ---------------------------------------------------------------
    def do_DELETE(self) -> None:
        path = urlsplit(self.path).path.rstrip("/") or "/"

        if path.startswith("/quotes/"):
            record_id = path[len("/quotes/"):]
            with _lock:
                ok = quotes_store.delete(record_id)
            if not ok:
                return self._send_error_detail(404, "Quote not found.")
            return self._send_json(200, {"deleted": record_id})

        if path.startswith("/products/"):
            product_id = path[len("/products/"):]
            if product_id in BUILT_IN_PRODUCT_IDS:
                return self._send_error_detail(400, "Built-in products cannot be deleted.")
            if product_id not in engine.configs:
                return self._send_error_detail(404, f"Unknown product_id '{product_id}'.")
            with _lock:
                del engine.configs[product_id]
                products_store.delete(product_id)
            return self._send_json(200, {"deleted": product_id})

        return self._send_error_detail(404, f"Not found: {path}")


def main() -> None:
    global QUOTE_RETENTION_MONTHS

    parser = argparse.ArgumentParser(description="FMM Loan Charges Engine — local API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--quote-retention-months", type=int, default=QUOTE_RETENTION_MONTHS,
                        help="Auto-delete quote history older than this many months "
                             "(0 disables). Default: 3.")
    args = parser.parse_args()
    QUOTE_RETENTION_MONTHS = args.quote_retention_months

    purge_expired_quotes()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"FMM Loan Charges Engine listening on http://{args.host}:{args.port}")
    print(f"Persisting custom products and quote history under {DATA_DIR}")
    if QUOTE_RETENTION_MONTHS > 0:
        print(f"Quote history older than {QUOTE_RETENTION_MONTHS} month(s) is auto-cleared.")
    else:
        print("Quote history retention is disabled (kept indefinitely).")
    print("Set VITE_ENGINE_API_URL to this address if it differs from the default.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
