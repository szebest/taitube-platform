#!/usr/bin/env python3
"""Print a PR's change table, split by kind: pr_stats.py [<base> [<head>]] [--files]."""
import fnmatch
import subprocess
import sys

KINDS = [
    ("Tests", [
        "*/__tests__/*", "*/__mocks__/*", "*/e2e/*", "*/fixtures/*", "tests/*",
        "*.test.*", "*.spec.*", "*.snap",
    ]),
    ("Generated", ["*/generated/*", "*.gen.*", "*/openapi.yaml", "*/openapi.json"]),
    ("Docs and skills", ["*.md", "*.mdx", "docs/*", ".agents/*", "*/.agents/*"]),
    ("Config and build", [
        "package.json", "*/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
        "turbo.json", "*/turbo.json", "tsconfig*.json", "*/tsconfig*.json",
        "*.config.*", "Dockerfile*", "*/Dockerfile*", "Makefile", "*.yml", "*.yaml",
        ".github/*", ".*ignore", "*/.*ignore", ".env*", "*.toml",
    ]),
]
PRODUCTION = "Production code"
ORDER = [PRODUCTION] + [name for name, _ in KINDS]


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def kind_of(path):
    for name, patterns in KINDS:
        if any(fnmatch.fnmatch(path, pattern) for pattern in patterns):
            return name
    return PRODUCTION


def main():
    args = [arg for arg in sys.argv[1:] if arg != "--files"]
    list_files = "--files" in sys.argv
    base = args[0] if args else "origin/main"
    head = args[1] if len(args) > 1 else "HEAD"
    span = f"{base}...{head}"

    status = {}
    fields = git("diff", "--name-status", "-M", "-z", span).split("\0")
    while len(fields) > 1:
        code = fields.pop(0)[0]
        if code in ("R", "C"):
            fields.pop(0)
        status[fields.pop(0)] = code

    rows = {name: {"files": [], "A": 0, "M": 0, "D": 0, "add": 0, "del": 0} for name in ORDER}
    fields = git("diff", "--numstat", "-M", "-z", span).split("\0")
    while len(fields) > 1:
        added, deleted, path = fields.pop(0).split("\t", 2)
        if path == "":
            fields.pop(0)
            path = fields.pop(0)
        code = status.get(path, "M")
        row = rows[kind_of(path)]
        row[code if code in ("A", "D") else "M"] += 1
        row["files"].append(f"{code} {path}")
        row["add"] += 0 if added == "-" else int(added)
        row["del"] += 0 if deleted == "-" else int(deleted)

    print("| Kind | Files | New | Changed | Deleted | Lines + | Lines - |")
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    total = {"files": 0, "A": 0, "M": 0, "D": 0, "add": 0, "del": 0}
    for name in ORDER:
        row = rows[name]
        if not row["files"]:
            continue
        count = len(row["files"])
        print(f"| {name} | {count} | {row['A']} | {row['M']} | {row['D']} | +{row['add']} | -{row['del']} |")
        total["files"] += count
        for key in ("A", "M", "D", "add", "del"):
            total[key] += row[key]
    print(
        f"| **Total** | **{total['files']}** | {total['A']} | {total['M']} | {total['D']} "
        f"| +{total['add']} | -{total['del']} |"
    )

    if list_files:
        for name in ORDER:
            if rows[name]["files"]:
                print(f"\n{name}:")
                for entry in sorted(rows[name]["files"]):
                    print(f"  {entry}")


if __name__ == "__main__":
    main()
