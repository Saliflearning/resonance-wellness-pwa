"""Scan tracked content, reachable history, and commit metadata for public risks."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
from pathlib import Path

MAX_BLOB_BYTES = 2_000_000
SCANNER_PATH = "scripts/repository-safety.py"
INTERNAL_PATH = re.compile(
    r"(^|/)(?:AGENTS|CLAUDE)\.md$|(^|/)(?:\.agents|\.claude|\.specify|specs|graphify-out)(/|$)",
    re.IGNORECASE,
)
FIREBASE_CONFIG = re.compile(
    r"(const\s+firebaseConfig\s*=\s*\{[\s\S]*?\bapiKey\s*:\s*[\"'])"
    r"AIza[0-9A-Za-z_-]{20,}([\"'][\s\S]*?\};)",
    re.IGNORECASE,
)
SVG_PATH_DATA = re.compile(r'\bd\s*=\s*(["\']).*?\1', re.IGNORECASE | re.DOTALL)
CHECKS = (
    ("private-path", re.compile(r"(?:[A-Z]:\\Users\\|/home/)", re.IGNORECASE)),
    ("legal-name", re.compile(r"\bSalif\s+Guingani\b", re.IGNORECASE)),
    (
        "email",
        re.compile(
            r"\b(?!(?:noreply@github\.com)\b)[A-Z0-9._%+-]+@(?!(?:users\.noreply\.github\.com|example\.(?:com|org|net))\b)[A-Z0-9.-]+\.[A-Z]{2,}\b",
            re.IGNORECASE,
        ),
    ),
    (
        "phone",
        re.compile(r"(?<!\d)(?:\+?1[ .-]?)?\(?[2-9]\d{2}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)"),
    ),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{20,}\b")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
)


def git(*args: str, text: bool = True) -> str | bytes:
    return subprocess.check_output(
        ["git", *args],
        text=text,
        encoding="utf-8" if text else None,
        errors="replace" if text else None,
    )


def scan_text(text: str, path: str, include_path_policy: bool) -> list[str]:
    if path == SCANNER_PATH:
        return []

    normalized = path.replace("\\", "/")
    findings: list[str] = []
    if include_path_policy and INTERNAL_PATH.search(normalized):
        findings.append(f"internal-artifact:{normalized}")

    # Firebase browser configuration is a public identifier, not an admin
    # credential. Permit only the key embedded inside the named client config;
    # detect any other Google API key-shaped value.
    scan_target = FIREBASE_CONFIG.sub(r'\1[PUBLIC_FIREBASE_CLIENT_KEY]\2', text)
    for category, pattern in CHECKS:
        if normalized.endswith("package-lock.json") and category in {"email", "phone"}:
            continue
        category_target = scan_target
        if category == "phone" and normalized.lower().endswith(".svg"):
            # Path-coordinate sequences can resemble North American phone
            # numbers. Ignore only the path-data attribute; visible SVG text
            # remains covered by the contact-data gate.
            category_target = SVG_PATH_DATA.sub('d="[SVG_PATH_DATA]"', category_target)
        if pattern.search(category_target):
            findings.append(f"{category}:{normalized}")
    return findings


def scan_current() -> list[str]:
    findings: list[str] = []
    for raw_path in git("ls-files", "-z").split("\0"):
        if not raw_path:
            continue
        path = Path(raw_path)
        try:
            with path.open("rb") as handle:
                if os.fstat(handle.fileno()).st_size > MAX_BLOB_BYTES:
                    continue
                data = handle.read(MAX_BLOB_BYTES + 1)
        except FileNotFoundError:
            continue
        if b"\0" not in data:
            findings.extend(scan_text(data.decode("utf-8", errors="replace"), raw_path, True))
    return findings


def scan_history() -> list[str]:
    findings: list[str] = []
    seen: set[str] = set()
    objects: list[tuple[str, str]] = []
    for line in git("rev-list", "--objects", "--all").splitlines():
        oid, _, path = line.partition(" ")
        if path and oid not in seen:
            seen.add(oid)
            objects.append((oid, path))

    process = subprocess.Popen(
        ["git", "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
    )
    assert process.stdin is not None and process.stdout is not None
    try:
        for oid, path in objects:
            process.stdin.write(f"{oid}\n".encode())
            process.stdin.flush()
            header = process.stdout.readline().decode("utf-8", errors="replace").strip()
            parts = header.split()
            if len(parts) != 3 or not parts[2].isdigit():
                continue
            size = int(parts[2])
            data = process.stdout.read(size)
            process.stdout.read(1)  # trailing newline
            if size <= MAX_BLOB_BYTES and b"\0" not in data:
                findings.extend(scan_text(data.decode("utf-8", errors="replace"), path, False))
    finally:
        process.stdin.close()
        process.stdout.close()
        process.wait(timeout=10)

    metadata = git("log", "--all", "--format=%an%x00%ae%x00%cn%x00%ce")
    findings.extend(scan_text(metadata, "git-commit-metadata", False))
    return findings


def self_test() -> list[str]:
    fixtures = {
        "legal-name": "Salif Guingani",
        "email": "owner@private.test",
        "phone": "317-555-0123",
        "google-api-key": "AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
        "aws-access-key": "AKIAABCDEFGHIJKLMNOP",
        "github-token": "ghp_abcdefghijklmnopqrstuvwxyz123456",
        "private-key": "-----BEGIN PRIVATE KEY-----",
        "private-path": r"C:\Users\owner\project",
        "jwt": "eyJabcdefghijk.abcdefghijk.abcdefghijk",
    }
    failures: list[str] = []
    for expected, fixture in fixtures.items():
        categories = {item.split(":", 1)[0] for item in scan_text(fixture, "fixture.txt", False)}
        if expected not in categories:
            failures.append(f"missing-self-test:{expected}")
    if scan_text("bot@users.noreply.github.com", "fixture.txt", False):
        failures.append("noreply-email-allowlist")
    if scan_text("noreply@github.com", "fixture.txt", False):
        failures.append("github-merge-email-allowlist")
    firebase_fixture = "const firebaseConfig = { apiKey: 'AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ123456789' };"
    if scan_text(firebase_fixture, "index.html", False):
        failures.append("firebase-client-config-allowlist")
    if scan_text('<path d="M960 500 1040 360"/>', "fixture.svg", False):
        failures.append("svg-path-coordinate-allowlist")
    svg_phone_categories = {
        item.split(":", 1)[0]
        for item in scan_text('<text>317-555-0123</text>', "fixture.svg", False)
    }
    if "phone" not in svg_phone_categories:
        failures.append("svg-visible-phone-detection")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--self-test", action="store_true")
    group.add_argument("--current", action="store_true")
    group.add_argument("--history", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        findings, mode = self_test(), "self-test"
    elif args.current:
        findings, mode = scan_current(), "current"
    else:
        findings, mode = scan_history(), "history"

    if findings:
        for finding in sorted(set(findings)):
            print(finding)
        print(f"Repository safety gate failed ({mode}).")
        return 1
    print(f"Repository safety gate passed ({mode}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
