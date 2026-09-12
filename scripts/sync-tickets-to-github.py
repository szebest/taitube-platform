#!/usr/bin/env python3
"""
Sync all local markdown tickets (docs/tickets/NN-slug.md) to GitHub Issues.
Zero external dependencies (uses standard library urllib.request).
"""
import os
import re
import glob
import json
import urllib.request
import urllib.error
import urllib.parse
import sys
import time

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "szebest/taitube-platform")
API_BASE = f"https://api.github.com/repos/{GITHUB_REPOSITORY}"

LABEL_CONFIGS = {
    # Phases
    "phase:0": {"color": "0075ca", "description": "Phase 0: Repository & Dev Foundation"},
    "phase:1": {"color": "1d76db", "description": "Phase 1: Ingestion & Transcoding Core"},
    "phase:2": {"color": "5319e7", "description": "Phase 2: Ladder, Resiliency & Scale"},
    "phase:3": {"color": "7057ff", "description": "Phase 3: Observability & Chaos Testing"},
    "phase:4": {"color": "008672", "description": "Phase 4: Cloud Overlay & Hardening"},
    "phase:5": {"color": "0e8a16", "description": "Phase 5: Full-Stack Platform & Frontend"},
    # Sizes
    "size:S": {"color": "c2e0c6", "description": "Small (~half session)"},
    "size:M": {"color": "fef2c0", "description": "Medium (~one session)"},
    "size:L": {"color": "fbca04", "description": "Large (~one long session)"},
    # Statuses
    "status:ready": {"color": "22c55e", "description": "Blockers done, ready to work"},
    "status:in-progress": {"color": "eab308", "description": "Currently in progress"},
    "status:blocked": {"color": "ef4444", "description": "Waiting on blocker tickets"},
    "status:done": {"color": "64748b", "description": "Completed and verified"},
    # Type
    "type:tracer-bullet": {"color": "bfd4f2", "description": "Vertical tracer-bullet slice"},
}

def gh_request(path, method="GET", data=None):
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    
    url = f"{API_BASE}{path}" if path.startswith("/") else path
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "taitube-ticket-sync",
        },
        method=method
    )
    if data is not None:
        req.data = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP {e.code} Error for {method} {url}: {body}", file=sys.stderr)
        raise

def ensure_labels():
    print("Ensuring GitHub labels exist...")
    existing_labels = {}
    page = 1
    while True:
        try:
            labels = gh_request(f"/labels?per_page=100&page={page}")
            if not labels:
                break
            for lbl in labels:
                existing_labels[lbl["name"]] = lbl
            if len(labels) < 100:
                break
            page += 1
        except Exception as e:
            print(f"Warning fetching labels: {e}")
            break
            
    for name, cfg in LABEL_CONFIGS.items():
        if name not in existing_labels:
            print(f"  Creating label: {name}")
            try:
                gh_request("/labels", method="POST", data={
                    "name": name,
                    "color": cfg["color"],
                    "description": cfg["description"]
                })
            except Exception as e:
                print(f"  Failed creating label {name}: {e}")
        else:
            # Update color/description if changed
            curr = existing_labels[name]
            if curr.get("color") != cfg["color"] or curr.get("description") != cfg["description"]:
                try:
                    gh_request(f"/labels/{urllib.parse.quote(name)}", method="PATCH", data={
                        "color": cfg["color"],
                        "description": cfg["description"]
                    })
                except Exception:
                    pass

def fetch_all_issues():
    print("Fetching existing GitHub issues...")
    issues = {}
    page = 1
    while True:
        data = gh_request(f"/issues?state=all&per_page=100&page={page}")
        if not data:
            break
        for issue in data:
            if "pull_request" in issue:
                continue
            title = issue.get("title", "")
            match = re.match(r"^\[#(\d\d)\]\s*(.*)", title)
            if match:
                num = int(match.group(1))
                issues[num] = issue
        if len(data) < 100:
            break
        page += 1
    print(f"Found {len(issues)} existing ticket issues.")
    return issues

def parse_tickets():
    tickets = []
    files = sorted(glob.glob("docs/tickets/[0-9][0-9]-*.md"))
    for f in files:
        num = int(os.path.basename(f)[:2])
        content = open(f, encoding="utf-8").read()
        title_match = re.search(r"^# \d\d: (.+)$", content, re.M)
        title = title_match.group(1) if title_match else os.path.basename(f)
        
        phase_m = re.search(r"\| Phase \| (.+?) \|", content)
        phase_raw = phase_m.group(1).split(" —")[0].strip() if phase_m else "5"
        phase_num = re.search(r"\d+", phase_raw)
        phase_str = phase_num.group(0) if phase_num else "5"
        
        size_m = re.search(r"\| Size \| (.+?) \|", content)
        size_raw = size_m.group(1).split(" ")[0].strip() if size_m else "M"
        if size_raw not in ("S", "M", "L", "XL"):
            size_raw = "M"
            
        status_m = re.search(r"\*\*Status:\*\* ([\w-]+)", content)
        status = status_m.group(1).strip() if status_m else "ready"
        if status not in ("done", "in-progress", "ready", "blocked", "blocked-by-date"):
            status = "ready"
        if status == "blocked-by-date":
            status = "blocked"
            
        tickets.append({
            "num": num,
            "file": f,
            "title": title,
            "phase": f"phase:{phase_str}",
            "size": f"size:{size_raw}",
            "status": f"status:{status}",
            "is_done": status == "done",
            "content": content
        })
    return tickets

def build_issue_body(ticket):
    file_path = ticket["file"].replace("\\", "/")
    blob_url = f"https://github.com/{GITHUB_REPOSITORY}/blob/main/{file_path}"
    
    header = f"> 📄 **Local Source of Truth:** [{ticket['file']}]({blob_url})\n\n---\n\n"
    return header + ticket["content"]

def sync():
    ensure_labels()
    existing_issues = fetch_all_issues()
    tickets = parse_tickets()
    print(f"Found {len(tickets)} local tickets to sync.\n")
    
    created_count = 0
    updated_count = 0
    
    for t in tickets:
        num = t["num"]
        issue_title = f"[#{num:02d}] {t['title']}"
        labels = [t["phase"], t["size"], t["status"], "type:tracer-bullet"]
        desired_state = "closed" if t["is_done"] else "open"
        body = build_issue_body(t)
        
        if num in existing_issues:
            curr = existing_issues[num]
            curr_labels = {lbl["name"] for lbl in curr.get("labels", [])}
            needed_labels = set(labels)
            
            needs_update = (
                curr.get("title") != issue_title
                or curr.get("state") != desired_state
                or curr_labels != needed_labels
            )
            
            if needs_update:
                print(f"Updating Issue #{curr['number']} ([#{num:02d}] {t['title'][:30]}...) -> state: {desired_state}")
                gh_request(f"/issues/{curr['number']}", method="PATCH", data={
                    "title": issue_title,
                    "body": body,
                    "state": desired_state,
                    "state_reason": "completed" if desired_state == "closed" else "reopened",
                    "labels": labels
                })
                updated_count += 1
                time.sleep(0.4)
        else:
            print(f"Creating Issue: {issue_title} ({t['status']})")
            created = gh_request("/issues", method="POST", data={
                "title": issue_title,
                "body": body,
                "labels": labels
            })
            if t["is_done"] and created:
                gh_request(f"/issues/{created['number']}", method="PATCH", data={
                    "state": "closed",
                    "state_reason": "completed"
                })
            created_count += 1
            time.sleep(0.5)
            
    print(f"\n Sync Completed: {created_count} created, {updated_count} updated.")

if __name__ == "__main__":
    sync()
