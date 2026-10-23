# bitecast-data

Nightly trout stocking collector for the BiteCast fishing app. A GitHub Action runs every morning,
reads each state's official stocking data, and publishes one clean file per state to GitHub Pages:

- `index.json`: all 50 states, with each wildlife agency's links, the kind of stocking data the
  state offers (`schedule` = dates ahead, `planned` = month or week ahead, `reports` = after the
  fact, `link` = official page only) and the state's bounding box.
- `stocking/XX.json`: one file per state with a reader. Every stocking has the water, county, date
  (`when`: `day`, `week` or `month`), species, and a point (exact, or the county centre when
  `approx` is true).

If a state's site fails one night, its last good file is kept and marked `ok: false`.

## States with readers

| State | Source | Kind |
| --- | --- | --- |
| PA | PA Fish & Boat trout stocking schedule | schedule |
| NJ | NJ Fish & Wildlife stocking schedule (NJDEP ArcGIS) | schedule |
| NY | NY DEC planned spring stocking (data.ny.gov) | planned |
| MD | Maryland DNR recent stockings feed | reports |

Adding a state: write `src/states/xx.mjs` exporting `kind`, `source` and `collect()` (returning
`item()`s from `src/lib.mjs`), then add it to `READERS` in `src/run.mjs`.

## Running locally

```
node src/run.mjs        # every state
node src/run.mjs PA NY  # just these
node tools/check-links.mjs
```

State outlines and county centres come from the US Census TIGERweb service (`data/`).
Stocking data belongs to each state agency; check their pages before you go.
