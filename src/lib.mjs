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
  const norm = (s) => s.toLowerCase().replace(/\b(county|parish|borough|city and borough|census area|city)\b/g, '').replace(/[^a-z]/g, '');
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
    species: [...new Set((o.species ?? []).map(fishName).filter(Boolean))],
    ...(o.count ? { count: o.count } : {}),
    ...(o.section ? { section: o.section } : {}),
    ...(o.detail ? { detail: o.detail } : {}),
    ...(o.meet ? { meet: o.meet } : {}),
    ...(p ? { lat: +(+p[0]).toFixed(5), lon: +(+p[1]).toFixed(5), approx: o.lat == null } : {}),
  };
}

const towns = {};
/** Centre of a town (Census county subdivision), for states that list towns, not counties. */
export async function townPoint(state, name) {
  if (!name) return null;
  if (!towns[state]) {
    const fips = STATES[state]?.fips;
    const j = await getJson(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/22/query?where=STATE%3D%27${fips}%27&outFields=BASENAME,INTPTLAT,INTPTLON&returnGeometry=false&f=json`);
    towns[state] = Object.fromEntries((j.features ?? []).map((f) => [f.attributes.BASENAME.toLowerCase(), [+f.attributes.INTPTLAT, +f.attributes.INTPTLON]]));
  }
  return towns[state][name.toLowerCase()] ?? null;
}

/** Small bait and forage fish states stock for food, not for anglers. */
const FORAGE = /\b(chub|sucker|dace|fathead|minnow|shiner|shad|cisco|herring|alewife|smelt|sculpin)\b/i;

/**
 * One name per fish across every state: "RB", "Rainbow", "rainbow trout" -> "Rainbow Trout";
 * "BASS LARGEMOUTH" -> "Largemouth Bass"; "MUSKIE TIGER" -> "Tiger Muskie". Forage fish -> null.
 */
export function fishName(raw) {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s || FORAGE.test(s)) return null;
  const t = s.toLowerCase();
  const rules = [
    [/golden rainbow|^golden$/, 'Golden Rainbow Trout'],
    [/golden trout/, 'Golden Trout'],
    [/steelhead/, 'Steelhead'],
    [/cutbow/, 'Cutbow Trout'],
    [/tiger trout/, 'Tiger Trout'],
    [/tiger mus|muskie tiger|muskellunge tiger/, 'Tiger Muskie'],
    [/splake/, 'Splake'],
    [/lake trout/, 'Lake Trout'],
    [/^rb$|rainbow/, 'Rainbow Trout'],
    [/^bn$|brown/, 'Brown Trout'],
    [/^bk$|brook/, 'Brook Trout'],
    [/cutthroat/, 'Cutthroat Trout'],
    [/grayling/, 'Arctic Grayling'],
    [/chinook|king salmon/, 'Chinook Salmon'],
    [/coho|silver salmon/, 'Coho Salmon'],
    [/sockeye/, 'Sockeye Salmon'],
    [/^chum|chum salmon/, 'Chum Salmon'],
    [/^pink$|pink salmon/, 'Pink Salmon'],
    [/kokanee/, 'Kokanee'],
    [/landlocked|atlantic salmon/, 'Landlocked Salmon'],
    [/saugeye/, 'Saugeye'],
    [/sauger/, 'Sauger'],
    [/walleye/, 'Walleye'],
    [/muskellunge|muskie|musky/, 'Muskellunge'],
    [/northern pike|^pike$/, 'Northern Pike'],
    [/wiper|hybrid striped|striped bass hybrid/, 'Wiper (Hybrid Striped Bass)'],
    [/striped bass|striper/, 'Striped Bass'],
    [/white bass|bass white/, 'White Bass'],
    [/largemouth/, 'Largemouth Bass'],
    [/smallmouth/, 'Smallmouth Bass'],
    [/channel cat|catfish channel/, 'Channel Catfish'],
    [/blue cat|catfish blue/, 'Blue Catfish'],
    [/flathead/, 'Flathead Catfish'],
    [/bluegill/, 'Bluegill'],
    [/redear/, 'Redear Sunfish'],
    [/sunfish/, 'Sunfish'],
    [/yellow perch|perch yellow/, 'Yellow Perch'],
    [/crappie/, 'Crappie'],
    [/sturgeon/, 'Sturgeon'],
    [/paddlefish/, 'Paddlefish'],
    [/whitefish/, 'Whitefish'],
  ];
  for (const [re, name] of rules) if (re.test(t)) return name;
  return title(s);
}
