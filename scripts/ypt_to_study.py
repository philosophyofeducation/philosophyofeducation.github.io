#!/usr/bin/env python3
"""Turn a YPT (열품타) study_full_timelines export into data/study.json.

Usage: python3 scripts/ypt_to_study.py timelines.json
Days already in data/study.json are kept and overwritten only for dates in the export.
Old YPT subject names are mapped onto the current ones below.
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

LOCAL = ZoneInfo("America/Chicago")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Current YPT subjects (slug -> display name), in the order they appear in YPT.
SUBJECTS = {
    "language": "Language",
    "post-structuralism": "Post Structuralism",
    "final-paper": "Final Paper",
    "psychoanalysis": "Psychoanalysis",
    "course-work": "Course Work",
    # Archived YPT subjects that have no current match
    "personal-research": "Personal Research",
    "philosophy-of-edu": "Philosophy of Edu",
}

# YPT subject name (trimmed) -> slug
MAP = {
    "language": "language", "영어": "language", "🗽영어 30m": "language",
    "post structuralism": "post-structuralism", "🐡포스트구조주의 리딩 1.5h": "post-structuralism",
    "final paper": "final-paper", "🎧silencing 기말 페이퍼 1h": "final-paper",
    "psychoanalysis": "psychoanalysis", "🫀lear 스터디 준비 1h": "psychoanalysis",
    "course work": "course-work", "🧑🏻‍🏫 course work": "course-work", "코스워크": "course-work", "🧑🏻‍🏫eram 리딩 2h": "course-work",
    "개인연구": "personal-research",
    "philosophy of edu": "philosophy-of-edu",
}


def slug_for(name):
    n = name.strip().lower()
    if n in MAP:
        return MAP[n]
    return "-".join("".join(c if c.isalnum() else " " for c in n).split()) or "other"


def main(path):
    raw = json.load(open(path, encoding="utf-8"))
    if isinstance(raw, list):  # tool wrapper
        raw = json.loads(raw[0]["text"])
    study_path = os.path.join(ROOT, "data", "study.json")
    study = json.load(open(study_path, encoding="utf-8"))
    days = study.get("days", {})
    starts = study.get("starts", {})
    for day in raw["days"]:
        first = next((t for t in day.get("timeline", []) if t.get("type") == "study" and (t.get("duration_min") or 0) > 0), None)
        if first:
            starts[day["date"]] = datetime.fromisoformat(first["start_at"]).astimezone(LOCAL).strftime("%H:%M")
        by = {}
        if day.get("subjects"):
            for s in day["subjects"]:
                k = slug_for(s["subject"])
                by[k] = by.get(k, 0) + s["study_minutes"]
        else:
            for t in day.get("timeline", []):
                if t.get("type") == "study":
                    k = slug_for(t["subject"])
                    by[k] = by.get(k, 0) + (t.get("duration_min") or 0)
        total = day.get("study_minutes") or 0
        diff = total - sum(by.values())
        if diff > 0:
            top = max(by, key=by.get) if by else "other"
            by[top] = by.get(top, 0) + diff
        by = {k: v for k, v in by.items() if v > 0}
        if by:
            days[day["date"]] = by
        else:
            days.pop(day["date"], None)
    for k in {s for d in days.values() for s in d}:
        SUBJECTS.setdefault(k, k.replace("-", " ").title())
    study["subjects"] = SUBJECTS
    study["days"] = dict(sorted(days.items()))
    study["starts"] = dict(sorted(starts.items()))
    study["updated"] = datetime.now(timezone(timedelta(hours=-6))).isoformat(timespec="minutes")
    json.dump(study, open(study_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("days:", len(study["days"]), "subjects:", sorted({s for d in days.values() for s in d}))


if __name__ == "__main__":
    main(sys.argv[1])
