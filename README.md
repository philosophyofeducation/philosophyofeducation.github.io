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

## Library
`data/library.json` lists books (`kind: book`) and papers (`kind: paper`) with `status` reading, done, or to-read. It mirrors the Reading log Google Sheet.

## Syncing study time
`python3 scripts/ypt_to_study.py <timelines.json>` turns a YPT timeline export into `data/study.json`, mapping old YPT subject names onto the current ones.

## Habits

`data/habits.json` holds one entry per day, for example:

```json
"2026-11-15": { "wake": "07:10", "bed": "23:40", "exercise": ["swim"], "processed": false, "fastHours": 13 }
```

`bed` is the time I fell asleep the night before. `exercise` is `[]` on a rest day. Study start time comes from YPT (`starts` in `data/study.json`). Goals live under `goals` at the top of the file.
