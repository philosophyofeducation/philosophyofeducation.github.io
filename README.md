# philosophyofeducation.github.io

Jinny Hyunjin Kim's personal site: study log, thoughts by subject, and blog.

## How it works
- `data/study.json` holds study minutes per subject per day, synced from the YPT (열품타) timer.
- `logs/YYYY-MM-DD.md` is one daily log. `posts/*.md` are blog posts.
- A GitHub Action rebuilds `logs/index.json` and `posts/index.json` whenever a log or post changes.

## Writing a daily log
Open the site with `#owner` at the end of the address once, and "Write today's log" buttons appear.

```
---
date: 2026-11-14
---

## Psychoanalysis
- What I covered (one line each)
> My own thought (shows up in mustard and is collected under Subjects)
```

Use the subject names from `data/study.json` as headings so time and notes line up.

## Writing a post
```
---
title: My title
date: 2026-11-14
category: essay        # essay, reading, notes
subjects: [psychoanalysis]
summary: One line shown in the list
---

Write in Markdown here.
```
