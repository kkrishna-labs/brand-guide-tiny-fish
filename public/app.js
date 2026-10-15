const $ = (id) => document.getElementById(id);
let last = null; // { guide, markdown, html }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function refreshWallet() {
  try {
    const r = await fetch('/api/wallet');
    const w = await r.json();
    $('wallet').textContent = w.available_balance != null
      ? `wallet: ${w.available_balance} ${w.currency || ''}`.trim()
      : 'wallet: n/a';
  } catch { $('wallet').textContent = 'wallet: offline'; }
}

function swatch(c) {
  const d = document.createElement('div');
  d.className = 'sw';
  d.innerHTML = `<div class="c"></div><code></code><div class="muted"></div>`;
  d.querySelector('.c').style.background = c.hex;
  d.querySelector('code').textContent = c.hex;
  d.querySelector('.muted').textContent = c.name;
  d.title = `${c.name} · ${c.rgb || ''} · ${c.usage || ''}`;
  return d;
}

function pills(arr) {
  return (arr || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('');
}

function render(payload) {
  last = payload;
  const g = payload.guide;
  $('result').hidden = false;

  $('company').textContent = g.company?.name || g.company?.website || 'Unknown';
  $('tagline').textContent = g.company?.tagline || '';
  $('desc').textContent = g.company?.description || '';
  $('conf').textContent = `confidence ${g.confidence?.overall ?? 'n/a'}`;
  $('extracted').textContent = g.extractedAt ? `extracted ${new Date(g.extractedAt).toLocaleString()}` : '';

  const logo = $('logo');
  if (g.logo?.wordmarkSvg) {
    logo.src = g.logo.wordmarkSvg; logo.hidden = false;
  } else if (g.logo?.primaryUrl && !g.logo.primaryUrl.endsWith('#inline-svg-logo')) {
    logo.src = g.logo.primaryUrl; logo.hidden = false;
  } else if (g.logo?.faviconUrl) {
    logo.src = g.logo.faviconUrl; logo.hidden = false;
  } else logo.hidden = true;

  const pal = $('palette'); pal.innerHTML = '';
  for (const k of ['primary', 'secondary', 'accent', 'neutral']) {
    for (const c of (g.colorPalette?.[k] || [])) pal.appendChild(swatch(c));
  }
  if (!pal.children.length) pal.innerHTML = '<span class="muted">No colors detected.</span>';

  const t = g.typography || {};
  $('type').innerHTML =
    `<div><b>Headings:</b> ${esc(t.headings?.fontFamily || 'unknown')}</div>` +
    `<div><b>Body:</b> ${esc(t.body?.fontFamily || 'unknown')}</div>` +
    (t.accent?.fontFamily ? `<div><b>Accent:</b> ${esc(t.accent.fontFamily)}</div>` : '') +
    ((t.cssFontFamilies || []).length ? `<div style="margin-top:6px">${pills(t.cssFontFamilies)}</div>` : '');

  const tone = g.toneOfVoice || {};
  $('tone').innerHTML =
    pills(tone.attributes) +
    (tone.description ? `<p>${esc(tone.description)}</p>` : '') +
    ((tone.examplePhrases || []).slice(0, 4).map((p) => `<blockquote>${esc(p)}</blockquote>`).join(''));

  const km = g.keyMessaging || {};
  $('messaging').innerHTML =
    (km.primaryHeadline ? `<p><b>${esc(km.primaryHeadline)}</b></p>` : '') +
    (km.elevatorPitch ? `<p>${esc(km.elevatorPitch)}</p>` : '') +
    ((km.valuePropositions || []).length ? `<ul>${km.valuePropositions.slice(0, 6).map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : '') +
    ((km.callsToAction || []).length ? `<div>${pills(km.callsToAction)}</div>` : '') +
    ((g.brandResources || []).length ? `<div style="margin-top:6px"><b>Brand resources:</b> ${g.brandResources.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.url)}</a>`).join(' · ')}</div>` : '') +
    (!km.primaryHeadline && !(km.valuePropositions || []).length ? '<span class="muted">Not detected.</span>' : '');

  const be = g.brandElements || {};
  $('elements').innerHTML =
    (be.mission ? `<div><b>Mission:</b> ${esc(be.mission)}</div>` : '') +
    (be.vision ? `<div><b>Vision:</b> ${esc(be.vision)}</div>` : '') +
    ((be.values || []).length ? `<div><b>Values:</b> ${esc(be.values.join('; '))}</div>` : '') +
    ((be.personality || []).length ? `<div style="margin-top:6px">${pills(be.personality)}</div>` : '') +
    (be.audience ? `<div><b>Audience:</b> ${esc(be.audience)}</div>` : '') +
    (!be.mission && !be.vision && !(be.values || []).length ? '<span class="muted">Not detected.</span>' : '');

  const im = $('imagery'); im.innerHTML = '';
  for (const src of (g.imagery?.exampleUrls || []).slice(0, 8)) {
    const img = document.createElement('img');
    img.src = src; img.loading = 'lazy'; img.alt = '';
    im.appendChild(img);
  }
  if (!im.children.length) im.innerHTML = '<span class="muted">No imagery captured.</span>';

  $('sources').innerHTML = (g.sourceUrls || []).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const website = $('website').value.trim();
  const mode = $('mode').value;
  const btn = $('go'), st = $('status');
  btn.disabled = true;
  st.className = 'status';
  const steps = ['fetching homepage…', 'discovering brand pages…', 'extracting logo, colors, fonts, tone…'];
  let i = 0;
  st.textContent = '⏳ ' + steps[0] + (mode === 'fast' ? ' (free)' : ' (paid agent…)');
  const tick = setInterval(() => { i = (i + 1) % steps.length; st.textContent = '⏳ ' + steps[i]; }, 4000);
  try {
    const r = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website, mode }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    render(data);
    st.textContent = `✓ done — ${data.guide.company?.name || website}`;
  } catch (err) {
    st.className = 'status err';
    st.textContent = '✖ ' + err.message;
  } finally {
    clearInterval(tick);
    btn.disabled = false;
  }
});

$('dlJson').onclick = () => last && download('brand.json', JSON.stringify(last.guide, null, 2), 'application/json');
$('dlMd').onclick = () => last && download('brand.md', last.markdown, 'text/markdown');
$('dlHtml').onclick = () => last && download('brand.html', last.html, 'text/html');

async function loadHistory() {
  const box = $('hist');
  const q = $('q').value.trim();
  try {
    const r = await fetch('/api/guides?limit=50' + (q ? `&q=${encodeURIComponent(q)}` : ''));
    const { rows, total } = await r.json();
    if (!rows.length) {
      box.innerHTML = '<span class="muted">No guides yet — generate one above.</span>';
      return;
    }
    box.innerHTML = '';
    for (const row of rows) {
      const el = document.createElement('div');
      el.className = 'hist-row';
      const when = new Date(row.created_at + (row.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString();
      el.innerHTML = `<div><div class="t"></div><div class="m"></div></div><div class="ops"></div>`;
      el.querySelector('.t').textContent = row.company_name || row.website;
      el.querySelector('.m').textContent = `${row.website} · ${row.mode} · ${when}`;
      const ops = el.querySelector('.ops');
      const open = document.createElement('button');
      open.textContent = 'Open';
      open.onclick = async () => {
        const gr = await fetch(`/api/guides/${row.id}`);
        render(await gr.json());
      };
      const md = document.createElement('button');
      md.textContent = 'MD';
      md.onclick = () => window.open(`/api/guides/${row.id}/markdown`, '_blank');
      const del = document.createElement('button');
      del.textContent = '✕';
      del.className = 'del';
      del.title = 'delete';
      del.onclick = async () => {
        if (!confirm(`Delete guide for ${row.website}?`)) return;
        await fetch(`/api/guides/${row.id}`, { method: 'DELETE' });
        loadHistory();
      };
      ops.append(open, md, del);
      box.appendChild(el);
    }
    if (total > rows.length) {
      const more = document.createElement('div');
      more.className = 'muted';
      more.textContent = `showing ${rows.length} of ${total}`;
      box.appendChild(more);
    }
  } catch (e) {
    box.innerHTML = `<span class="muted">history unavailable: ${esc(e.message)}</span>`;
  }
}

$('reload').onclick = loadHistory;
$('q').addEventListener('input', () => { clearTimeout(window.__hq); window.__hq = setTimeout(loadHistory, 300); });

// refresh history after each new extraction
const _render = render;
render = function (payload) { _render(payload); loadHistory(); };

refreshWallet();
loadHistory();
