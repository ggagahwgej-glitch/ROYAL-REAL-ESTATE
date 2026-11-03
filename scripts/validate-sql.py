#!/usr/bin/env python3
"""Parse every Supabase SQL file with the real PostgreSQL grammar.

Optional dev dependency:  pip install pglast
(use a venv if your system Python is externally managed).

This catches unterminated dollar quotes, broken statements and malformed
PL/pgSQL blocks *before* pasting a script into the Supabase SQL Editor.
It does NOT execute anything and needs no database connection.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

try:
    from pglast import parse_sql, parse_plpgsql
except ImportError:
    print("SKIPPED: pglast is not installed. Run: python3 -m venv .venv && "
          ".venv/bin/pip install pglast && .venv/bin/python scripts/validate-sql.py")
    sys.exit(0)

failures = 0
for path in sorted((ROOT / "supabase").glob("*.sql")):
    sql = path.read_text()
    try:
        statements = parse_sql(sql)
    except Exception as exc:  # noqa: BLE001 - report every parse error
        failures += 1
        print(f"FAIL  {path.relative_to(ROOT)}: {exc}")
        continue

    bodies = re.findall(r"(\$[A-Za-z_]*\$)(.*?)\1", sql, re.S)
    for tag, body in bodies:
        # Ignore comment-only lines: some files contain fully commented-out
        # example blocks that are not executable PL/pgSQL.
        code = "\n".join(line for line in body.splitlines()
                          if not line.lstrip().startswith("--"))
        if not re.search(r"\b(begin|declare)\b", code, re.I):
            continue  # SQL-language function body or commented example
        returns = "trigger" if "new." in body or "RETURN new" in body else "void"
        probe = (f"CREATE FUNCTION __probe() RETURNS {returns} LANGUAGE plpgsql AS "
                 + tag + body + tag + ";")
        try:
            parse_plpgsql(probe)
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"FAIL  {path.relative_to(ROOT)}: PL/pgSQL block: {exc}")
    print(f"OK    {str(path.relative_to(ROOT)):42s} {len(statements):3d} statements, "
          f"{len(bodies)} quoted bodies")

print("ALL SQL VALID" if not failures else f"{failures} SQL PROBLEM(S)")
sys.exit(1 if failures else 0)
