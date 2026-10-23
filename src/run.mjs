// Nightly run: collects every state that has a reader, writes one JSON file per state plus an
// index of all 50 states (agency links, what kind of data each has, its bounding box), into public/.
// If a state's site fails tonight, its last good file (from the published site) is kept and marked
// stale, so one broken state never wipes out data in the app.
//
// Usage: node src/run.mjs [ST ...]   (no states = all)   env PREVIOUS = published base URL

import { mkdirSync, writeFileSync } from 'node:fs';
import { DIRECTORY } from './directory.mjs';
import { STATES } from './lib.mjs';
import * as md from './states/md.mjs';
import * as nj from './states/nj.mjs';
import * as ny from './states/ny.mjs';
import * as pa from './states/pa.mjs';
import * as va from './states/va.mjs';
import * as vt from './states/vt.mjs';

const READERS = { PA: pa, NY: ny, NJ: nj, MD: md, VA: va, VT: vt };
const OUT = new URL('../public/', import.meta.url);
const PREVIOUS = process.env.PREVIOUS ?? '';

mkdirSync(new URL('stocking/', OUT), { recursive: true });

/** Keep the file small: drop anything older than 60 days, except a planned state's season plan. */
const fresh = (items, kind) => {
  const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const year = String(new Date().getFullYear());
  return items.filter((i) => i.date >= cutoff || i.when === 'month' || (kind === 'planned' && i.date.startsWith(year))).sort((a, b) => a.date.localeCompare(b.date) || a.water.localeCompare(b.water));
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
      const items = fresh(await reader.collect(), reader.kind);
      const file = { state: st, kind: reader.kind, source: reader.source, updated: now, ok: true, items };
      writeFileSync(new URL(`stocking/${st}.json`, OUT), JSON.stringify(file));
      Object.assign(entry, { updated: now, ok: true, count: items.length });
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
console.log(`index: ${Object.keys(index.states).length} states`);
