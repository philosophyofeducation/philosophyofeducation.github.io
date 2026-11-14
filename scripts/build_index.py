#!/usr/bin/env python3
"""Build posts/index.json and logs/index.json from the Markdown files.

Run from the repository root:  python3 scripts/build_index.py
GitHub Actions runs this automatically whenever a post or log changes.

Log format (logs/YYYY-MM-DD.md):
    ---
    date: 2026-11-14
    ---
    ## Subject name
    - something I covered
    > a thought of my own

Post format (posts/YYYY-MM-DD-slug.md):
    ---
    title: ...
    date: 2026-11-14
    category: essay | reading | life | notes
    subjects: [psychoanalysis, philosophy-of-education]
    summary: one line
    ---
    Markdown body...
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def split_front_matter(raw):
    raw = raw.replace("\r\n", "\n")
    if raw.startswith("---\n"):
        end = raw.find("\n---", 4)
        if end != -1:
            head = raw[4:end]
            body = raw[end + 4:].lstrip("\n")
            return parse_yaml(head), body
    return {}, raw


def parse_yaml(head):
    data = {}
    for line in head.split("\n"):
        if ":" not in line or line.strip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if value.startswith("[") and value.endswith("]"):
            items = [v.strip().strip("'\"") for v in value[1:-1].split(",")]
            data[key] = [i for i in items if i]
        else:
            data[key] = value.strip("'\"")
    return data


def build_posts():
    folder = os.path.join(ROOT, "posts")
    posts = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".md"):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as f:
            meta, body = split_front_matter(f.read())
        if str(meta.get("draft", "")).lower() == "true":
            continue
        slug = name[:-3]
        slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", slug) or slug
        date = meta.get("date") or name[:10]
        subjects = meta.get("subjects") or []
        if isinstance(subjects, str):
            subjects = [s.strip() for s in subjects.split(",") if s.strip()]
        posts.append({
            "slug": slugify(slug),
            "file": "posts/" + name,
            "title": meta.get("title") or slug.replace("-", " ").title(),
            "date": date,
            "category": (meta.get("category") or "notes").lower(),
            "subjects": [slugify(s) for s in subjects],
            "summary": meta.get("summary", ""),
            "body": body,
        })
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def build_logs():
    folder = os.path.join(ROOT, "logs")
    logs = []
    for name in sorted(os.listdir(folder)):
        if not re.match(r"^\d{4}-\d{2}-\d{2}\.md$", name):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as f:
            meta, body = split_front_matter(f.read())
        sections, current, intro = [], None, []
        for line in body.split("\n"):
            s = line.strip()
            if s.startswith("## "):
                current = {"name": s[3:].strip(), "slug": slugify(s[3:]), "covered": [], "thoughts": []}
                sections.append(current)
            elif current is None:
                if s:
                    intro.append(s)
            elif s.startswith(("- ", "* ")):
                current["covered"].append(s[2:].strip())
            elif s.startswith(">"):
                text = s.lstrip(">").strip()
                if text:
                    current["thoughts"].append(text)
            elif s and current["covered"]:
                current["covered"][-1] += " " + s
        logs.append({
            "date": meta.get("date") or name[:10],
            "mood": meta.get("mood", ""),
            "intro": " ".join(intro),
            "sections": sections,
        })
    logs.sort(key=lambda l: l["date"], reverse=True)
    return logs


def main():
    with open(os.path.join(ROOT, "posts", "index.json"), "w", encoding="utf-8") as f:
        json.dump(build_posts(), f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "logs", "index.json"), "w", encoding="utf-8") as f:
        json.dump(build_logs(), f, ensure_ascii=False, indent=1)
    print("Indexes built.")


if __name__ == "__main__":
    main()
