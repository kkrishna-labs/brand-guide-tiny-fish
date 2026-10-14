/**
 * Free offline brand extraction from TinyFish fetch results.
 * Input: pages = [{ url, markdown: {...}|null, html: {...}|null }]
 * No agent calls — pure parsing, $0.
 */

const STOPWORDS = new Set(
  'the,a,an,and,or,of,to,in,on,for,with,by,at,from,as,is,are,was,were,be,been,it,its,this,that,these,those,you,your,we,our,they,their,he,she,his,her,not,but,all,can,will,just,more,than,into,out,up,down,over,under,get,got,see,also,one,two,new,first,learn,read,view,explore,discover,shop,buy,sign,login,start,trial,free,demo,home,menu,search,contact,about,privacy,terms,cookies'.split(',')
);

function words(text, n = 40) {
  const freq = new Map();
  for (const w of (text || '').toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function pageText(page) {
  return page.markdown?.text || page.html?.text || '';
}

function pageHtml(page) {
  return page.html?.format === 'html' ? page.html.text || '' : '';
}

// ---------------------------------------------------------------- company
function extractCompany(baseUrl, pages) {
  const home = pages[0]?.markdown || pages[0]?.html || {};
  let name = home.title || null;
  if (name) {
    // "Stripe | Financial Infrastructure..." -> "Stripe"
    name = name.split(/[|–—·•-]/)[0].trim() || name.trim();
    if (name.length > 60) name = null;
  }
  if (!name) {
    try {
      name = new URL(baseUrl).hostname.replace(/^www\./, '');
    } catch {
      name = null;
    }
  }
  const description = home.description || firstSentence(pageText(pages[0] || {}));
  const tagline = extractTagline(pages);
  return { name, website: baseUrl, tagline, description: description || null };
}

function firstSentence(text) {
  const m = (text || '').replace(/\s+/g, ' ').match(/^.{20,220}?[.!\n]/);
  return m ? m[0].trim() : null;
}

function extractTagline(pages) {
  const text = pageText(pages[0] || {});
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of lines.slice(0, 12)) {
    const clean = l.replace(/^[#>*\s]+/, '').replace(/\*+/g, '').trim();
    if (/(sign up|log in|get started|subscribe|download app)/i.test(clean) && clean.length < 60) continue;
    if (clean.length >= 15 && clean.length <= 120 && !clean.endsWith('.')) return clean;
  }
  return null;
}

// ---------------------------------------------------------------- logo
function extractLogo(baseUrl, pages) {
  const found = [];
  const seen = new Set();
  const push = (u, scoreBoost) => {
    const a = u && absUrl(u, baseUrl);
    if (!a) return;
    if (!/\.(svg|png|jpe?g|webp|gif|ico)(\?|#|$)/i.test(a)) return;
    if (seen.has(a)) return;
    seen.add(a);
    found.push({ url: a, score: scoreBoost || 0 });
  };
  const logoScore = (u) => {
    let s = 0;
    if (/\/logo[\w-]*\.(svg|png|webp)/i.test(u)) s += 50;
    if (/logo/i.test(u)) s += 20;
    if (/brand|site-logo|navbar-brand|header-logo/i.test(u)) s += 15;
    if (/\/favicon|apple-touch-icon|\.ico/i.test(u)) s -= 40;
    if (/tidemark|hero|banner|og-image|thumbnail|customer|enterprise-accordion|payment-bento/i.test(u)) s -= 30;
    if (/\.svg/i.test(u)) s += 10;
    if (/w=\d+/.test(u)) s -= 2; // responsive variants rank lower
    return s;
  };

  for (const p of pages) {
    for (const u of p.markdown?.image_links || []) {
      push(u, logoScore(u) + (/logo|brand|mark/i.test(u) ? 25 : 0));
    }
    const html = pageHtml(p);
    const imgRe = /<img[^>]*>/gi;
    let m;
    while ((m = imgRe.exec(html)) !== null) {
      const tag = m[0];
      if (/logo|brand|site-logo|navbar-brand/i.test(tag)) {
        const src = tag.match(/(?:src|data-src)=["']([^"']+)["']/i);
        if (src) push(src[1], logoScore(src[1]) + 30);
      }
    }
    const linkRe = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[0].match(/href=["']([^"']+)["']/i);
      if (href) push(href[1], -40);
    }
    if (found.length >= 30) break;
  }

  // Fallback: best-scoring image on home. Decorative images (hero, banner,
  // tidemark, customer photos) score negative so they lose to logo-ish ones.
  // If nothing scores >= 0, keep primaryUrl null rather than a wrong image.
  if (found.length === 0) {
    const imgs = pages[0]?.markdown?.image_links || [];
    for (const u of imgs.slice(0, 10)) push(u, logoScore(u));
  }

  const logos = found.filter((f) => f.score >= 0).sort((a, b) => b.score - a.score);
  // No logo-ish image found: leave null (raw-html enrichment may still find
  // an inline-SVG wordmark + SVG favicon). Never promote decorative images.
  const pool = logos;
  const logoImgs = pool.filter((f) => !/favicon|apple-touch-icon|\.ico/i.test(f.url));
  const favicons = pool.filter((f) => /favicon|apple-touch-icon|\.ico/i.test(f.url));
  const primaryUrl = (logoImgs[0] || {}).url || null;
  const secondaryUrl = (logoImgs[1] || {}).url || null;
  const formats = [...new Set(pool.map((f) => (f.url.match(/\.([a-z0-9]+)(?:[?#]|$)/i) || [])[1]).filter(Boolean).map((s) => s.toUpperCase()))];
  return { primaryUrl, secondaryUrl, faviconUrl: (favicons[0] || {}).url || `${baseUrl}/favicon.ico`, formats };
}


// ---------------------------------------------------------------- colors
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function normalizeHex(h) {
  h = (h || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) return ('#' + h.slice(1).split('').map((c) => c + c).join('')).toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(h)) return h.toUpperCase();
  return null;
}

function extractColors(pages) {
  const counts = new Map();
  const touch = (hex, ctx, cssVar = null) => {
    hex = normalizeHex(hex);
    if (!hex) return;
    if (!counts.has(hex)) counts.set(hex, { count: 0, contexts: new Set(), cssVars: new Set() });
    const e = counts.get(hex);
    e.count += 1;
    if (ctx) e.contexts.add(ctx);
    if (cssVar) e.cssVars.add(cssVar);
  };
  const cssVars = [];
  for (const p of pages) {
    const html = pageHtml(p).slice(0, 300000);
    for (const m of html.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
      touch(m[2], 'css-variable', m[1]);
      cssVars.push(`${m[1]}: ${normalizeHex(m[2])}`);
    }
    for (const m of html.matchAll(/(?:color|background(?:-color)?|border-color|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,6})\b/gi)) {
      touch(m[1], 'inline-style');
    }
    for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
      touch(m[0], 'stylesheet');
    }
    for (const m of html.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
      const r = +m[1]; const g = +m[2]; const b = +m[3];
      if (r <= 255 && g <= 255 && b <= 255) {
        touch('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''), 'rgb-value');
      }
    }
  }
  const ranked = [...counts.entries()]
    .map(([hex, e]) => ({ hex, rgb: hexToRgb(hex), count: e.count, usage: [...e.contexts].join(', ') || 'site styles' }))
    .sort((a, b) => b.count - a.count);
  const isNeutral = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
    return Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };
  const neutrals = ranked.filter((c) => isNeutral(c.hex)).slice(0, 6);
  const chroma = ranked.filter((c) => !isNeutral(c.hex));
  return {
    primary: chroma.slice(0, 3).map((c, i) => ({ name: 'Primary ' + (i + 1), hex: c.hex, rgb: c.rgb, usage: c.usage })),
    secondary: chroma.slice(3, 7).map((c, i) => ({ name: 'Secondary ' + (i + 1), hex: c.hex, rgb: c.rgb, usage: c.usage })),
    neutral: neutrals.map((c, i) => ({ name: 'Neutral ' + (i + 1), hex: c.hex, rgb: c.rgb, usage: c.usage })),
    accent: chroma.slice(0, 2).map((c, i) => ({ name: 'Accent ' + (i + 1), hex: c.hex, rgb: c.rgb, usage: c.usage })),
    cssVariables: [...new Set(cssVars)].slice(0, 50),
  };
}


// ---------------------------------------------------------------- typography
function extractTypography(pages) {
  const fams = new Map();
  const urls = new Set();
  const addFam = (f) => {
    f = (f || '').replace(/["']/g, '').trim();
    if (!f || /^(inherit|initial|unset|normal)$/i.test(f)) return;
    fams.set(f, (fams.get(f) || 0) + 1);
  };
  for (const p of pages) {
    const html = pageHtml(p).slice(0, 400000);
    const parts = html.match(/font-family\s*:\s*([^;}{]+)[;}{]/gi) || [];
    for (const part of parts) {
      part.replace(/font-family\s*:\s*/i, '').replace(/[;}{]$/, '').split(',').forEach(addFam);
    }
    const linkRe = /<link[^>]*href=["']([^"']*(?:fonts\.googleapis|typekit|fontshare)[^"']*)["'][^>]*>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) { const a = absUrl(m[1], p.url); urls.add(a || m[1]); }
    const faceRe = /@font-face\s*{[^}]*}/gi;
    while ((m = faceRe.exec(html)) !== null) {
      const fam = m[0].match(/font-family\s*:\s*["']?([^;"'}]+)/i);
      if (fam) addFam(fam[1]);
      const src = m[0].match(/url\(["']?([^)"']+)/i);
      if (src) { const a = absUrl(src[1], p.url); urls.add(a || src[1]); }
    }
  }
  const ranked = [...fams.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const empty = { fontFamily: null, fontWeight: null, fontSize: null, lineHeight: null, letterSpacing: null };
  return {
    headings: { ...empty, fontFamily: ranked[0] || null },
    body: { ...empty, fontFamily: ranked[1] || ranked[0] || null },
    accent: { ...empty, fontFamily: ranked[2] || null },
    fontUrls: [...urls].slice(0, 20),
    cssFontFamilies: ranked.slice(0, 12),
  };
}

// ---------------------------------------------------------------- tone + misc
const TONE_LEXICON = [
  [/innovative|cutting-edge|next-gen|pioneer|reinvent/i, 'innovative'],
  [/trusted|secure|reliable|proven|guarantee/i, 'trustworthy'],
  [/simple|easy|effortless|intuitive|seamless/i, 'approachable'],
  [/powerful|scale|enterprise|robust|performance/i, 'authoritative'],
  [/friendly|welcome|love|delight|joy|fun/i, 'friendly'],
  [/fast|instant|quick|real-time/i, 'dynamic'],
  [/global|world|everywhere/i, 'ambitious'],
  [/sustainable|responsible|community|inclusive/i, 'conscientious'],
  [/premium|luxury|exclusive|craft/i, 'premium'],
  [/playful|witty|quirky/i, 'playful'],
  [/bold|fearless|disrupt/i, 'bold'],
  [/expert|leader|award/i, 'expert'],
];

function extractTone(pages) {
  const text = pages.map(pageText).join('\n');
  const attrs = [];
  for (const [re, label] of TONE_LEXICON) {
    if (re.test(text) && !attrs.includes(label)) attrs.push(label);
  }
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]{20,140}[.!?]/g) || [];
  const examplePhrases = [...new Set(sentences.map((s) => s.trim()))].slice(0, 8);
  const exclam = (text.match(/!/g) || []).length;
  const avgLen = sentences.length ? sentences.join(' ').length / sentences.length : 0;
  const formality = /(hereby|therefore|moreover|furthermore)/i.test(text) ? 'formal' : exclam > 5 ? 'casual' : 'neutral';
  const technicality = /(API|SDK|infrastructure|architecture|protocol|latency)/i.test(text) ? 'technical' : 'accessible';
  const emotion = exclam > 8 ? 'emotional' : /(data|metrics|benchmark|uptime|SLA)/i.test(text) ? 'rational' : 'balanced';
  const topWords = words(text);
  const description = attrs.length
    ? 'Voice is ' + attrs.slice(0, 3).join(', ') + (avgLen > 110 ? ', long-form explanatory copy' : ', concise punchy copy') + '. Top vocabulary: ' + topWords.slice(0, 8).join(', ') + '.'
    : 'Voice analysis based on ' + sentences.length + ' sentences. Top vocabulary: ' + topWords.slice(0, 8).join(', ') + '.';
  return {
    attributes: attrs.slice(0, 8),
    description,
    examplePhrases,
    doAndDont: {
      do: attrs.slice(0, 3).map((a) => 'Write ' + a + ' copy in the brand voice'),
      dont: ['Avoid jargon inconsistent with site copy', 'Avoid sudden formality shifts'],
    },
    writingStyle: { formality, technicality, emotion },
  };
}

function extractBrandElements(baseUrl, pages) {
  const text = pages.map(pageText).join('\n---\n');
  const grab = (labels) => {
    for (const label of labels) {
      const re = new RegExp(label + '\\s*[:\\-–—]?\\s*([^\\n]{20,300})', 'i');
      const m = text.match(re);
      if (m) return m[1].trim();
    }
    return null;
  };
  const mission = grab(['our mission(?: statement)?', 'mission']);
  const vision = grab(['our vision(?: statement)?', 'vision']);
  const values = [];
  const vm = text.match(/values?\s*[:\\-–—]?\\s*([^\\n]{10,300})/i);
  if (vm) {
    for (const chunk of vm[1].split(/[,•·|]/)) {
      const c = chunk.trim();
      if (c.length > 2 && c.length < 60) values.push(c);
    }
  }
  const personality = words(text, 12).slice(0, 6);
  const audience = grab(['target audience', 'who we serve', 'built for', 'designed for', 'for teams', 'for businesses']);
  return { mission, vision, values: values.slice(0, 10), personality, audience, differentiators: [] };
}

function extractImagery(baseUrl, pages) {
  const urls = [];
  const seen = new Set();
  for (const p of pages.slice(0, 3)) {
    for (const u of p.markdown?.image_links || []) {
      const a = absUrl(u, p.url || baseUrl);
      if (a && !seen.has(a)) { seen.add(a); urls.push(a); }
      if (urls.length >= 12) break;
    }
  }
  const hero = urls[0] || null;
  return {
    style: hero ? 'Photography-led marketing imagery (see examples)' : null,
    exampleUrls: urls,
    guidelines: null,
  };
}

export function localExtract(baseUrl, pages) {
  const safe = (Array.isArray(pages) ? pages : []).filter((p) => p && (p.markdown || p.html));
  const list = safe.length > 0 ? safe : [];
  const company = extractCompany(baseUrl, list.length ? list : [{ url: baseUrl, markdown: null, html: null }]);
  const logo = extractLogo(baseUrl, list);
  const colorPalette = extractColors(list);
  const typography = extractTypography(list);
  const toneOfVoice = extractTone(list);
  const brandElements = extractBrandElements(baseUrl, list);
  const imagery = extractImagery(baseUrl, list);
  return { company, logo, colorPalette, typography, toneOfVoice, brandElements, imagery };
}
