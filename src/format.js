/**
 * Render a brand guide as Markdown / HTML / JSON.
 */

function swatch(c) {
  return `  - **${c.name}** \`${c.hex}\` (${c.rgb || 'n/a'}) — ${c.usage || ''}`;
}

function logoLabel(url) {
  if (!url) return 'not found';
  return url.startsWith('data:') ? 'inline SVG wordmark (embedded)' : url;
}

function section(title, body) {
  return `## ${title}\n\n${body}\n`;
}

export function toMarkdown(g) {
  const L = [];
  L.push(`# Brand Guide: ${g.company?.name || g.company?.website || 'Unknown'}`);
  L.push('');
  L.push(`- Website: ${g.company?.website || 'n/a'}`);
  if (g.company?.tagline) L.push(`- Tagline: ${g.company.tagline}`);
  if (g.company?.description) L.push(`- Description: ${g.company.description}`);
  L.push(`- Extracted: ${g.extractedAt || 'n/a'} | Confidence: ${g.confidence?.overall ?? 'n/a'}`);
  L.push(`- Sources: ${(g.sourceUrls || []).join(', ')}`);
  L.push('');
  const logoLines = [
    `- Primary: ${logoLabel(g.logo?.primaryUrl)}`,
    ...(g.logo?.wordmarkSvg ? ['- Wordmark: inline SVG captured from the site header (`logo.wordmarkSvg` in JSON)'] : []),
    `- Secondary: ${g.logo?.secondaryUrl || 'not found'}`,
    `- Favicon: ${g.logo?.faviconUrl || 'not found'}`,
  ];
  if (g.logo?.formats?.length) logoLines.push(`- Formats: ${g.logo.formats.join(', ')}`);
  L.push(section('Logo', logoLines.join('\n')));
  const pal = g.colorPalette || {};
  const palLines = [];
  for (const [key, label] of [['primary', 'Primary'], ['secondary', 'Secondary'], ['neutral', 'Neutral'], ['accent', 'Accent']]) {
    const arr = pal[key] || [];
    if (arr.length) { palLines.push(`### ${label}`); arr.forEach((c) => palLines.push(swatch(c))); palLines.push(''); }
  }
  if ((pal.cssVariables || []).length) {
    palLines.push('### CSS variables');
    pal.cssVariables.slice(0, 30).forEach((v) => palLines.push(`  - \`${v}\``));
  }
  if (!palLines.length) palLines.push('_No colors detected._');
  L.push(section('Colour palette', palLines.join('\n')));
  const t = g.typography || {};
  L.push(section('Typography',
    `- Headings: ${t.headings?.fontFamily || 'unknown'}\n- Body: ${t.body?.fontFamily || 'unknown'}` +
    (t.accent?.fontFamily ? `\n- Accent: ${t.accent.fontFamily}` : '') +
    ((t.cssFontFamilies || []).length ? `\n- Detected families: ${t.cssFontFamilies.join(', ')}` : '') +
    ((t.fontUrls || []).length ? `\n- Font URLs:\n${t.fontUrls.map((u) => `  - ${u}`).join('\n')}` : '')));
  const tone = g.toneOfVoice || {};
  L.push(section('Tone of voice',
    (tone.attributes?.length ? `- Attributes: ${tone.attributes.join(', ')}\n` : '') +
    (tone.description ? `- ${tone.description}\n` : '') +
    ((tone.examplePhrases || []).length ? `- Examples:\n${tone.examplePhrases.map((p) => `  > ${p}`).join('\n')}` : '')));
  const be = g.brandElements || {};
  const beLines = [];
  if (be.mission) beLines.push(`- Mission: ${be.mission}`);
  if (be.vision) beLines.push(`- Vision: ${be.vision}`);
  if ((be.values || []).length) beLines.push(`- Values: ${be.values.join('; ')}`);
  if ((be.personality || []).length) beLines.push(`- Personality signals: ${be.personality.join(', ')}`);
  if (be.audience) beLines.push(`- Audience: ${be.audience}`);
  if ((be.differentiators || []).length) beLines.push(`- Differentiators: ${be.differentiators.join('; ')}`);
  L.push(section('Key brand elements', beLines.length ? beLines.join('\n') : '_Not detected._'));
  const km = g.keyMessaging || {};
  const kmLines = [];
  if (km.primaryHeadline) kmLines.push(`- Primary headline: **${km.primaryHeadline}**`);
  if (km.elevatorPitch) kmLines.push(`- Elevator pitch: ${km.elevatorPitch}`);
  if ((km.headlines || []).length > 1) kmLines.push(`- Headlines:\n${km.headlines.slice(1).map((h) => `  - ${h}`).join('\n')}`);
  if ((km.valuePropositions || []).length) kmLines.push(`- Value propositions:\n${km.valuePropositions.map((h) => `  - ${h}`).join('\n')}`);
  if ((km.callsToAction || []).length) kmLines.push(`- Calls to action: ${km.callsToAction.map((c) => `\`${c}\``).join(' · ')}`);
  L.push(section('Key messaging', kmLines.length ? kmLines.join('\n') : '_Not detected._'));
  if ((g.brandResources || []).length) {
    L.push(section('Brand resources (found via search)', g.brandResources.map((r) => `- [${r.title || r.url}](${r.url})`).join('\n')));
  }
  const im = g.imagery || {};
  L.push(section('Imagery',
    (im.style ? `- Style: ${im.style}\n` : '') +
    ((im.exampleUrls || []).length ? `- Examples:\n${im.exampleUrls.slice(0, 10).map((u) => `  - ${u}`).join('\n')}` : '_No imagery captured._')));
  if (g.error) L.push(`\n> Extraction note: ${g.error}\n`);
  return L.join('\n');
}

export function toHTML(g) {
  const pal = g.colorPalette || {};
  const all = [...(pal.primary || []), ...(pal.secondary || []), ...(pal.accent || []), ...(pal.neutral || [])];
  const swatches = all.map((c) =>
    `<div style="display:inline-block;width:120px;margin:6px;text-align:center;font-family:sans-serif">` +
    `<div style="width:120px;height:64px;border-radius:8px;border:1px solid #ddd;background:${c.hex}"></div>` +
    `<div style="font-size:12px;margin-top:4px"><b>${c.name}</b><br>${c.hex}<br><span style="color:#666">${c.usage || ''}</span></div></div>`
  ).join('\n');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Brand Guide — ${esc(g.company?.name)}</title></head>` +
    `<body style="font-family:sans-serif;max-width:900px;margin:24px auto;padding:0 16px">` +
    `<h1>Brand Guide: ${esc(g.company?.name || g.company?.website)}</h1>` +
    `<p><a href="${esc(g.company?.website)}">${esc(g.company?.website)}</a>` +
    (g.company?.tagline ? ` — <em>${esc(g.company.tagline)}</em>` : '') + `</p>` +
    (g.company?.description ? `<p>${esc(g.company.description)}</p>` : '') +
    `<h2>Logo</h2><p>Primary: ${g.logo?.primaryUrl && !g.logo.primaryUrl.startsWith('data:') ? `<a href="${esc(g.logo.primaryUrl)}">${esc(g.logo.primaryUrl)}</a>` : esc(logoLabel(g.logo?.primaryUrl))}` +
    (g.logo?.wordmarkSvg ? `<br><img src="${g.logo.wordmarkSvg}" alt="wordmark" style="max-height:48px;margin-top:8px">` :
      g.logo?.primaryUrl ? `<br><img src="${esc(g.logo.primaryUrl)}" alt="logo" style="max-height:80px;margin-top:8px">` : '') +
    `<br>Favicon: ${esc(g.logo?.faviconUrl || 'n/a')}</p>` +
    `<h2>Colour palette</h2><div>${swatches || 'No colors detected.'}</div>` +
    `<h2>Typography</h2><p>Headings: ${esc(g.typography?.headings?.fontFamily || 'unknown')} | ` +
    `Body: ${esc(g.typography?.body?.fontFamily || 'unknown')}</p>` +
    `<h2>Tone of voice</h2><p>${esc((g.toneOfVoice?.attributes || []).join(', '))}</p>` +
    (g.toneOfVoice?.description ? `<p>${esc(g.toneOfVoice.description)}</p>` : '') +
    messagingHTML(g.keyMessaging, esc) +
    ((g.brandResources || []).length ? `<h2>Brand resources</h2><ul>${g.brandResources.map((r) => `<li><a href="${esc(r.url)}">${esc(r.title || r.url)}</a></li>`).join('')}</ul>` : '') +
    `<h2>Sources</h2><ul>${(g.sourceUrls || []).map((u) => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('')}</ul>` +
    `<p style="color:#888;font-size:12px">Extracted ${esc(g.extractedAt)} · confidence ${esc(g.confidence?.overall)}</p>` +
    `</body></html>`;
}

function messagingHTML(km, esc) {
  if (!km) return '';
  const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<h2>Key messaging</h2>` +
    (km.primaryHeadline ? `<p style="font-size:22px;font-weight:600">${esc(km.primaryHeadline)}</p>` : '') +
    (km.elevatorPitch ? `<p>${esc(km.elevatorPitch)}</p>` : '') +
    ((km.valuePropositions || []).length ? `<h3>Value propositions</h3>${list(km.valuePropositions)}` : '') +
    ((km.callsToAction || []).length ? `<h3>Calls to action</h3><p>${km.callsToAction.map((c) => `<code>${esc(c)}</code>`).join(' · ')}</p>` : '');
}

/**
 * W3C Design Tokens (DTCG) JSON — importable by Figma Tokens Studio,
 * Style Dictionary, etc. Colours + font families only (what we can verify).
 */
export function toDesignTokens(g) {
  const pal = g.colorPalette || {};
  const color = {};
  for (const group of ['primary', 'secondary', 'accent', 'neutral']) {
    const arr = pal[group] || [];
    if (!arr.length) continue;
    color[group] = {};
    arr.forEach((c, i) => { color[group][String(i + 1)] = { $type: 'color', $value: c.hex }; });
  }
  const t = g.typography || {};
  const font = {};
  for (const role of ['headings', 'body', 'accent']) {
    if (t[role]?.fontFamily) font[role] = { $type: 'fontFamily', $value: t[role].fontFamily };
  }
  return {
    $description: `Brand tokens for ${g.company?.name || g.company?.website} — extracted ${g.extractedAt}`,
    color,
    font,
  };
}
