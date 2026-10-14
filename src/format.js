/**
 * Render a brand guide as Markdown / HTML / JSON.
 */

function swatch(c) {
  return `  - **${c.name}** \`${c.hex}\` (${c.rgb || 'n/a'}) — ${c.usage || ''}`;
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
    `- Primary: ${g.logo?.primaryUrl || 'not found'}`,
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
    `<h2>Logo</h2><p>Primary: ${g.logo?.primaryUrl ? `<a href="${esc(g.logo.primaryUrl)}">${esc(g.logo.primaryUrl)}</a>` : 'not found'}` +
    (g.logo?.primaryUrl ? `<br><img src="${esc(g.logo.primaryUrl)}" alt="logo" style="max-height:80px;margin-top:8px">` : '') +
    `<br>Favicon: ${esc(g.logo?.faviconUrl || 'n/a')}</p>` +
    `<h2>Colour palette</h2><div>${swatches || 'No colors detected.'}</div>` +
    `<h2>Typography</h2><p>Headings: ${esc(g.typography?.headings?.fontFamily || 'unknown')} | ` +
    `Body: ${esc(g.typography?.body?.fontFamily || 'unknown')}</p>` +
    `<h2>Tone of voice</h2><p>${esc((g.toneOfVoice?.attributes || []).join(', '))}</p>` +
    (g.toneOfVoice?.description ? `<p>${esc(g.toneOfVoice.description)}</p>` : '') +
    `<h2>Sources</h2><ul>${(g.sourceUrls || []).map((u) => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('')}</ul>` +
    `<p style="color:#888;font-size:12px">Extracted ${esc(g.extractedAt)} · confidence ${esc(g.confidence?.overall)}</p>` +
    `</body></html>`;
}
