// Tiny HTML table helpers for state pages that publish stockings as plain tables.

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

export const tables = (html) => html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
export const rows = (table) => table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

/** Cell texts of a row; list items and line breaks inside a cell become "; ". */
export const cells = (row) =>
  (row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map((c) =>
    decode(c.replace(/<\/li>\s*<li[^>]*>|<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/^[;\s]+|[;\s]+$/g, '').trim());
