// Shared helpers for the state readers: polite HTTP with time limits, county centres for
// stockings that come without coordinates, and dates.

import { readFileSync } from 'node:fs';

const UA = 'BiteCast-data/1.0 (nightly trout stocking collector; https://github.com)';

export const STATES = JSON.parse(readFileSync(new URL('../data/states.json', import.meta.url), 'utf8'));
const COUNTIES = JSON.parse(readFileSync(new URL('../data/counties.json', import.meta.url), 'utf8'));

async function request(url, init = {}, ms = 45000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
    if (!r.ok) throw new Error(`${url} answered ${r.status}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}

export const getJson = async (url) => (await request(url)).json();
export const getText = async (url) => (await request(url)).text();
export const postJsonText = async (url, body) =>
  (await request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json; charset=utf-8' } })).text();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Centre of a county ("Centre", "Centre County", "St. Mary's"), or null. */
export function countyPoint(state, county) {
  const list = COUNTIES[state];
  if (!list || !county) return null;
  const norm = (s) => s.toLowerCase().replace(/\b(county|parish|borough|city and borough|census area)\b/g, '').replace(/[^a-z]/g, '');
  const want = norm(county);
  const key = Object.keys(list).find((k) => norm(k) === want);
  return key ? list[key] : null;
}

export const countyNames = (state) => Object.keys(COUNTIES[state] ?? {});

/** YYYY-MM-DD from a Date in local terms (the date itself, not a moment). */
export const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const title = (s) => String(s ?? '').toLowerCase().replace(/(^|[\s\-/(.])([a-z])/g, (_, a, b) => a + b.toUpperCase()).trim();

/**
 * One stocking, in the shape every state file uses.
 * when: 'day' (that date), 'week' (the week starting that date) or 'month' (sometime that month).
 */
export function item(state, o) {
  const p = o.lat != null && o.lon != null ? [o.lat, o.lon] : countyPoint(state, o.county);
  return {
    water: o.water,
    county: o.county ?? '',
    date: o.date,
    when: o.when ?? 'day',
    species: o.species ?? [],
    ...(o.count ? { count: o.count } : {}),
    ...(o.section ? { section: o.section } : {}),
    ...(o.detail ? { detail: o.detail } : {}),
    ...(o.meet ? { meet: o.meet } : {}),
    ...(p ? { lat: +(+p[0]).toFixed(5), lon: +(+p[1]).toFixed(5), approx: o.lat == null } : {}),
  };
}
