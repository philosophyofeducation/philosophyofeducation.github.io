#!/usr/bin/env python3
"""Turn a Vocabulary Bank export (Google Sheets values for Words!A:M) into data/words.json.

Usage: python3 scripts/sheet_to_words.py export.json
The export is the JSON returned by the Sheets values API: {"values": [[header...], [row...], ...]}.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = {"Status": "status", "Category": "cat", "Subcategory": "sub", "Word": "word", "English meaning": "en",
        "Korean meaning": "ko", "Usage pattern": "usage", "Etymology": "ety", "Memory tip": "tip",
        "Example from text": "text", "Source": "source", "Another example": "ex", "Date added": "date"}


def split_examples(s):
    s = (s or "").strip()
    if not s:
        return []
    parts = re.split(r"(?:^|\n|\s)(?=\d[.)]\s)", s)
    out = [re.sub(r"^\d[.)]\s*", "", p).strip() for p in parts]
    out = [p for p in out if p]
    return out if len(out) > 1 else [p.strip() for p in s.split(" / ") if p.strip()]


def main(path):
    v = json.load(open(path, encoding="utf-8"))["values"]
    head = [KEYS.get(h.strip(), h.strip()) for h in v[0]]
    words = []
    for row in v[1:]:
        row = row + [""] * (len(head) - len(row))
        w = {head[i]: (row[i] or "").strip() for i in range(len(head))}
        if not w.get("word"):
            continue
        w["ex"] = split_examples(w.get("ex"))
        w["status"] = w.get("status") or "new"
        if w.get("source", "").startswith("(asked"):
            w["source"] = ""
        words.append(w)
    out = {"source": "Vocabulary Bank (Google Sheets)", "count": len(words), "words": words}
    json.dump(out, open(os.path.join(ROOT, "data", "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("words:", len(words))


if __name__ == "__main__":
    main(sys.argv[1])
