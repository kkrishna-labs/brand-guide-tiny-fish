/**
 * Enrich a locally-extracted guide with the site's RAW HTML + stylesheets.
 * TinyFish `fetch content` returns cleaned text (no <style>, no CSS links),
 * so colors/fonts/nav-logo must come from the raw document. Plain HTTPS GET.
 */

import { pickFontRoles } from './local-extract.js';

const CTA_VERB = /^(get|start|try|book|request|contact|sign up|join|see|watch|explore|learn|download|talk|create|build|shop|discover|buy|order|subscribe)\b/i;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) brand-guide-generator/1.0';

function absUrl(href, base) {
  try {
    return new URL(href.replace(/&amp;/g, '&'), base).href;
  } catch {
    return null;
  }
}

async function getText(url, budget) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf).slice(0, budget || 3000000);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractCssColors(css) {
  const counts = new Map();
  const touch = (hex) => {
    hex = hex.toUpperCase();
    if (/^#[0-9A-F]{3}$/.test(hex)) hex = '#' + hex.slice(1).split('').map((c) => c + c).join('');
    counts.set(hex, (counts.get(hex) || 0) + 1);
  };
  const varRe = /--([a-zA-Z0-9-_]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g;
  let m;
  while ((m = varRe.exec(css)) !== null) {
    touch(m[2]);
    // Design-token names are the strongest brand signal we get from CSS.
    if (/brand|primary|accent|link|highlight/i.test(m[1])) for (let i = 0; i < 6; i++) touch(m[2]);
  }
  const propRe = /(?:color|background(?:-color)?|border(?:-top|-bottom|-left|-right)?-color|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,6})\b/gi;
  while ((m = propRe.exec(css)) !== null) touch(m[1]);
  const hexRe = /#[0-9a-fA-F]{6}\b/g;
  while ((m = hexRe.exec(css)) !== null) touch(m[0]);
  return counts;
}

function extractFontVars(css, into) {
  const re = /(--[a-zA-Z0-9-_]*font[a-zA-Z0-9-_]*)\s*:\s*([^;}{]+)[;}]/gi;
  let m;
  while ((m = re.exec(css)) !== null) if (!into.has(m[1])) into.set(m[1], m[2].trim());
  return into;
}

function extractCssFonts(css, fontVars = new Map()) {
  const fams = new Map();
  const famRe = /font-family\s*:\s*([^;}{]+)[;}{]/gi;
  let m;
  while ((m = famRe.exec(css)) !== null) {
    // font-family: var(--font-regular) -> the stack that variable defines.
    const value = m[1].replace(/var\((--[\w-]+)[^)]*\)/g, (all, v) => fontVars.get(v) || all);
    // Only the first family is the intended font; the rest are fallbacks.
    for (const f of value.split(',').slice(0, 1)) {
      const clean = f.replace(/["']/g, '').trim();
      const clean2 = clean.replace(/\s*!important$/i, '');
      // Minified CSS sometimes yields junk like "object-fit\: cover".
      if (clean2 && !/[:\\{}()]/.test(clean2) && clean2.length < 40 && !/^(inherit|initial|unset|sans-serif|serif|monospace)$/i.test(clean2)) {
        fams.set(clean2, (fams.get(clean2) || 0) + 1);
      }
    }
  }
  return fams;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
}


/** Mutates guide in place; returns { colorsAdded, fontsAdded }. */
export async function enrichWithRawHtml(baseUrl, guide) {
  const stats = { colorsAdded: 0, fontsAdded: 0, navLogo: null, favicon: null };
  let html = null;
  try {
    html = await getText(baseUrl);
  } catch {
    html = null;
  }
  if (!html) return stats;

  const icons = [];
  const iconRe = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = iconRe.exec(html)) !== null) {
    const a = absUrl(m[1], baseUrl);
    if (a) icons.push(a);
  }
  if (icons.length) {
    guide.logo.faviconUrl = icons[0];
    if (!guide.logo.formats.includes('ICO') && /\.ico/i.test(icons[0])) guide.logo.formats.push('ICO');
    if (!guide.logo.formats.includes('SVG') && /\.svg/i.test(icons[0])) guide.logo.formats.push('SVG');
  }
  stats.favicon = guide.logo.faviconUrl;

  const headerMatch = html.match(/<header[\s\S]{0,60000}?<\/header>/i);
  const navMatch = html.match(/<nav[\s\S]{0,30000}?<\/nav>/i);
  const headerHtml = (headerMatch && headerMatch[0]) || (navMatch && navMatch[0]) || html.slice(0, 120000);
  const logoImg = headerHtml.match(/<img[^>]*(?:logo|brand)[^>]*>/i) || headerHtml.match(/<img[^>]*>/i);
  const logoSrc = logoImg ? logoImg[0].match(/(?:src|data-src)=["']([^"']+)["']/i) : null;
  if (logoSrc) {
    const a = absUrl(logoSrc[1], baseUrl);
    if (a && a !== guide.logo.primaryUrl && /\.(svg|png|jpe?g|webp|gif)(\?|#|$)/i.test(a)) {
      if (guide.logo.primaryUrl) guide.logo.secondaryUrl = guide.logo.primaryUrl;
      guide.logo.primaryUrl = a;
      stats.navLogo = a;
      const ext = (a.match(/\.([a-z0-9]+)(?:[?#]|$)/i) || [])[1];
      if (ext && !guide.logo.formats.includes(ext.toUpperCase())) guide.logo.formats.unshift(ext.toUpperCase());
    }
  }
  // Inline SVG wordmark in header (common: Stripe, Vercel, Linear render the
  // nav logo as inline <svg>, so no <img> URL exists). Record fact + favicon
  // SVG as the downloadable logo asset.
  if (!stats.navLogo) {
    const svgInHeader = /<svg[^>]*aria-label=["'][^"']*(logo|stripe|home)[^"']*["'][^>]*>/i.test(headerHtml)
      || (/<svg[\s\S]{0,20000}?<\/svg>/i.test(headerHtml) && /<header/i.test(html));
    if (svgInHeader) {
      stats.navLogo = 'inline-svg-wordmark';
      const svgIcon = icons.find((u) => /\.svg/i.test(u));
      if (svgIcon) {
        if (guide.logo.primaryUrl && !/favicon/i.test(guide.logo.primaryUrl)) {
          guide.logo.secondaryUrl = guide.logo.primaryUrl;
        }
        guide.logo.primaryUrl = svgIcon;
        if (!guide.logo.formats.includes('SVG')) guide.logo.formats.unshift('SVG');
      }
    }
  }

  // Keep the actual wordmark markup: it is the logo a designer wants.
  // Most reliable first: the SVG inside the header's home/logo link, then an
  // SVG labelled as the logo, then a sprite <symbol id="…logo…"> (Patagonia).
  const labelled = html.slice(0, 400000).match(/<svg\b[^>]*aria-label=["'][^"']*\blogo\b[^"']*["'][^>]*>[\s\S]{0,30000}?<\/svg>/i);
  const homeLink = headerHtml.match(/<a\b[^>]*(?:aria-label=["'][^"']*\b(?:home|logo)\b|class=["'][^"']*\b(?:logo|home-link|brand)|href=["']\/["'])[^>]*>\s*(?:<[^>]+>\s*){0,3}(<svg[\s\S]{0,30000}?<\/svg>)/i);
  const sym = html.match(/<symbol\b([^>]*\bid=["'][^"']*logo[^"']*["'][^>]*)>([\s\S]{0,30000}?)<\/symbol>/i);
  const symSvg = sym && `<svg ${(sym[1].match(/viewBox=["'][^"']+["']/i) || [''])[0]}>${sym[2]}</svg>`;
  const isMark = (s) => s && s.length > 200 && /<path\b/i.test(s);
  const wordmark = [homeLink && homeLink[1], labelled && labelled[0], symSvg].find(isMark) || null;
  if (wordmark) {
    const withNs = /xmlns=/.test(wordmark) ? wordmark : wordmark.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    guide.logo.wordmarkSvg = 'data:image/svg+xml;base64,' + Buffer.from(withNs).toString('base64');
    // The nav wordmark is the logo; keep a hosted logo file (or the icon) as secondary.
    const hosted = guide.logo.primaryUrl;
    guide.logo.secondaryUrl = hosted && /logo/i.test(hosted) ? hosted : guide.logo.faviconUrl;
    guide.logo.primaryUrl = guide.logo.wordmarkSvg;
  }

  // CTAs: TinyFish's cleaned HTML/markdown drop link text, so read buttons here.
  if (guide.keyMessaging) {
    const counts = new Map();
    for (const mm of html.matchAll(/<(a|button)\b[^>]*>([\s\S]{2,400}?)<\/\1>/gi)) {
      const t = mm[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/[→›»!]/g, '').replace(/\s+/g, ' ').trim();
      if (t.length < 3 || t.length > 32) continue;
      if (!CTA_VERB.test(t)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    const ctas = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    guide.keyMessaging.callsToAction = [...new Set([...(guide.keyMessaging.callsToAction || []), ...ctas])].slice(0, 6);
  }

  // ---- stylesheets ----
  // Component-split builds (Next/Vite) spread tokens over dozens of small
  // files, so read them all (parallel, capped) rather than the first few.
  const cssHrefs = [];
  const linkRe = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const a = absUrl(m[1], baseUrl);
    if (a && !cssHrefs.includes(a)) cssHrefs.push(a);
    if (cssHrefs.length >= 40) break;
  }
  let inlineCss = '';
  const styleRe = /<style[^>]*>([\s\S]{0,500000}?)<\/style>/gi;
  while ((m = styleRe.exec(html)) !== null) inlineCss += '\n' + m[1];

  const docSlice = html.slice(0, 500000) + inlineCss;
  const sheets = (await Promise.all(cssHrefs.map((h) => getText(h, 1500000)))).filter(Boolean);
  const fontVars = new Map();
  for (const css of [docSlice, ...sheets]) extractFontVars(css, fontVars);
  const colorCounts = extractCssColors(docSlice);
  const fams = extractCssFonts(docSlice, fontVars);

  for (const css of sheets) {
    for (const [hex, n] of extractCssColors(css)) colorCounts.set(hex, (colorCounts.get(hex) || 0) + n * 2);
    for (const [fam, n] of extractCssFonts(css, fontVars)) fams.set(fam, (fams.get(fam) || 0) + n * 2);
    const urlRe = /url\((https:[^)]+)\)/g;
    let u;
    while ((u = urlRe.exec(css)) !== null) {
      if (/fonts\.(googleapis|gstatic)/.test(u[1]) && guide.typography.fontUrls.length < 20) {
        guide.typography.fontUrls.push(u[1]);
      }
    }
  }
  const gfontRe = /<link[^>]*href=["']([^"']*fonts\.googleapis[^"']*)["'][^>]*>/gi;
  while ((m = gfontRe.exec(html)) !== null) {
    const a = absUrl(m[1], baseUrl);
    if (a && !guide.typography.fontUrls.includes(a)) guide.typography.fontUrls.push(a);
  }

  // ---- merge colors ----
  const ranked = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const isNeutral = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
    return Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };
  const have = new Set();
  for (const k of ['primary', 'secondary', 'neutral', 'accent']) {
    for (const c of guide.colorPalette[k] || []) have.add(c.hex);
  }
  const fresh = ranked.filter(([hex]) => !have.has(hex));
  const chroma = fresh.filter(([hex]) => !isNeutral(hex));
  const neutrals = fresh.filter(([hex]) => isNeutral(hex)).slice(0, 4);
  const mk = (hex, i, kind) => ({ name: kind + ' ' + (i + 1), hex, rgb: hexToRgb(hex), usage: 'site stylesheet' });
  const addP = chroma.slice(0, 3).map(([hex], i) => mk(hex, (guide.colorPalette.primary || []).length + i, 'Primary'));
  const addS = chroma.slice(3, 7).map(([hex], i) => mk(hex, (guide.colorPalette.secondary || []).length + i, 'Secondary'));
  const addA = chroma.slice(0, 2).map(([hex], i) => mk(hex, (guide.colorPalette.accent || []).length + i, 'Accent'));
  const addN = neutrals.map(([hex], i) => mk(hex, (guide.colorPalette.neutral || []).length + i, 'Neutral'));
  guide.colorPalette.primary = [...(guide.colorPalette.primary || []), ...addP];
  guide.colorPalette.secondary = [...(guide.colorPalette.secondary || []), ...addS];
  guide.colorPalette.accent = [...(guide.colorPalette.accent || []), ...addA];
  guide.colorPalette.neutral = [...(guide.colorPalette.neutral || []), ...addN];
  stats.colorsAdded = addP.length + addS.length + addA.length + addN.length;

  // ---- merge fonts ----
  const rankedFams = [...fams.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const haveFams = new Set(guide.typography.cssFontFamilies || []);
  for (const f of rankedFams) {
    if (!haveFams.has(f) && guide.typography.cssFontFamilies.length < 12) {
      guide.typography.cssFontFamilies.push(f);
      haveFams.add(f);
    }
  }
  // Stylesheets are the source of truth for type; page-inline styles are not.
  const roles = pickFontRoles([...rankedFams, ...guide.typography.cssFontFamilies]);
  for (const k of ['headings', 'body', 'accent']) {
    if (roles[k]) guide.typography[k].fontFamily = roles[k];
  }
  stats.fontsAdded = rankedFams.length;
  return stats;
}

