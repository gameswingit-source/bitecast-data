// Nightly run: collects every state that has a reader, writes one JSON file per state plus an
// index of all 50 states (agency links, what kind of data each has, its bounding box), into public/.
// If a state's site fails tonight, its last good file (from the published site) is kept and marked
// stale, so one broken state never wipes out data in the app.
//
// Usage: node src/run.mjs [ST ...]   (no states = all)   env PREVIOUS = published base URL

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { DIRECTORY } from './directory.mjs';
import { STATES } from './lib.mjs';
import * as md from './states/md.mjs';
import * as nj from './states/nj.mjs';
import * as ny from './states/ny.mjs';
import * as pa from './states/pa.mjs';
import * as ut from './states/ut.mjs';
import * as va from './states/va.mjs';
import * as vt from './states/vt.mjs';
import * as wa from './states/wa.mjs';

const READERS = { PA: pa, NY: ny, NJ: nj, MD: md, VA: va, VT: vt, UT: ut, WA: wa };
const OUT = new URL('../public/', import.meta.url);
const PREVIOUS = process.env.PREVIOUS ?? '';

mkdirSync(new URL('stocking/', OUT), { recursive: true });

/** Keep this year's season (and anything in the last 60 days, across New Year), drop older. */
const fresh = (items) => {
  const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const year = String(new Date().getFullYear());
  return items.filter((i) => i.date >= cutoff || i.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date) || a.water.localeCompare(b.water));
};

async function previous(st) {
  if (!PREVIOUS) return null;
  try {
    const r = await fetch(`${PREVIOUS}/stocking/${st}.json`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const only = process.argv.slice(2).map((s) => s.toUpperCase());
const now = new Date().toISOString();
const index = { updated: now, format: 1, states: {} };

for (const [st, dir] of Object.entries(DIRECTORY)) {
  const geo = STATES[st];
  const reader = READERS[st];
  const entry = {
    name: geo?.name ?? st,
    bbox: geo?.bbox,
    agency: dir.agency,
    home: dir.home,
    stocking: dir.stocking,
    trout: dir.trout,
    kind: reader ? reader.kind : 'link',
  };
  if (reader && (!only.length || only.includes(st))) {
    const started = Date.now();
    try {
      const items = fresh(await reader.collect());
      const file = { state: st, kind: reader.kind, source: reader.source, updated: now, ok: true, items };
      writeFileSync(new URL(`stocking/${st}.json`, OUT), JSON.stringify(file));
      // Which fish this state stocks, most stocked first, for the app's state list.
      const tally = {};
      for (const i of items) for (const sp of i.species) tally[sp] = (tally[sp] ?? 0) + 1;
      const species = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k]) => k);
      Object.assign(entry, { updated: now, ok: true, count: items.length, species });
      console.log(`${st}: ${items.length} stockings in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    } catch (e) {
      const prev = await previous(st);
      if (prev) {
        writeFileSync(new URL(`stocking/${st}.json`, OUT), JSON.stringify({ ...prev, ok: false, error: String(e.message ?? e) }));
        Object.assign(entry, { updated: prev.updated, ok: false, count: prev.items?.length ?? 0 });
      } else Object.assign(entry, { ok: false, count: 0 });
      console.log(`${st}: FAILED (${e.message ?? e})${prev ? ', kept the last good file' : ''}`);
    }
  }
  index.states[st] = entry;
}

writeFileSync(new URL('index.json', OUT), JSON.stringify(index));
writeFileSync(new URL('.nojekyll', OUT), '');
// Static pages published alongside the data (the app's privacy policy).
const SITE = new URL('../site/', import.meta.url);
if (existsSync(SITE)) cpSync(SITE, OUT, { recursive: true });
console.log(`index: ${Object.keys(index.states).length} states`);
