import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { localExtract } from '../src/local-extract.js';
import { toMarkdown, toHTML } from '../src/format.js';
import { BrandGuideExtractor } from '../src/brand-extractor.js';

const BASE = 'https://example.com';
const pages = [
  {
    url: BASE,
    markdown: {
      title: 'Acme | We build widgets',
      description: 'Acme builds widgets for teams.',
      text: 'Acme builds widgets for teams. Our mission: make work simple and joyful. We are trusted and friendly. Try it now! Fast, simple, global platform.',
      links: [BASE + '/about', BASE + '/pricing'],
      image_links: [BASE + '/assets/logo.svg', BASE + '/assets/hero.png'],
    },
    html: {
      format: 'html',
      text: '<html><head><link rel="icon" href="/favicon.ico"></head><body>'
        + '<style>:root{ --brand-primary: #635BFF; --brand-ink: #0A2540; }</style>'
        + '<img alt="Acme logo" src="/assets/logo.svg">'
        + '<p style="color:#635BFF;font-family:Inter, sans-serif">hi</p>'
        + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700" rel="stylesheet">'
        + '</body></html>',
    },
  },
];

describe('localExtract', () => {
  it('extracts logo, colors, fonts, tone', () => {
    const g = localExtract(BASE, pages);
    assert.equal(g.company.name, 'Acme');
    assert.equal(g.logo.primaryUrl, BASE + '/assets/logo.svg');
    // fixture html has font-family:Inter inline + Google Fonts link → parsed
    assert.ok((g.typography.cssFontFamilies || []).some((f) => /inter/i.test(f)));
    assert.ok(g.toneOfVoice.attributes.length > 0);
    assert.ok(g.company.website === BASE);
    assert.ok((g.imagery.exampleUrls || []).length > 0);
  });

  it('never promotes decorative images to logo', () => {
    const g = localExtract(BASE, [{
      url: BASE,
      markdown: { title: 'X', text: 'hello world test test', links: [], image_links: [BASE + '/hero-banner.webp', BASE + '/tidemark-mobile.png'] },
      html: { format: 'html', text: '<main>hi</main>' },
    }]);
    assert.equal(g.logo.primaryUrl, null);
  });
});

describe('format', () => {
  it('renders markdown + html without throwing', () => {
    const g = localExtract(BASE, pages);
    const full = {
      ...g, company: { ...g.company }, extractedAt: new Date().toISOString(),
      sourceUrls: [BASE], confidence: { logo: 1, colors: 1, typography: 1, tone: 1, overall: 1 },
    };
    const md = toMarkdown(full);
    assert.ok(md.includes('# Brand Guide: Acme'));
    assert.ok(md.includes('#635BFF'));
    const html = toHTML(full);
    assert.ok(html.includes('Brand Guide: Acme'));
    assert.ok(html.includes('#635BFF'));
  });
});

describe('BrandGuideExtractor helpers', () => {
  it('normalizeUrl + finalizeBrandGuide + fallback', () => {
    const ex = new BrandGuideExtractor({ fetchContent: async () => ({ results: [], errors: [] }) });
    assert.equal(ex.normalizeUrl('stripe.com'), 'https://stripe.com');
    assert.equal(ex.normalizeUrl('https://stripe.com/'), 'https://stripe.com');
    const fin = ex.finalizeBrandGuide(
      { company: { name: 'X' }, logo: { primaryUrl: 'u' }, colorPalette: { primary: [{ hex: '#fff' }] }, typography: { headings: { fontFamily: 'F' } }, toneOfVoice: { attributes: ['friendly'] } },
      'https://x.com'
    );
    assert.equal(fin.company.website, 'https://x.com');
    assert.ok(fin.confidence.overall > 0);
    const fb = ex.createFallbackGuide('https://x.com', 'boom');
    assert.equal(fb.confidence.overall, 0);
    assert.equal(fb.error, 'boom');
  });

  it('combineContent joins page texts', () => {
    const ex = new BrandGuideExtractor({});
    const s = ex.combineContent([{ url: 'a', markdown: { title: 'T', text: 'hello' }, html: null }]);
    assert.ok(s.includes('hello'));
  });

  it('unwrapAgentResult handles nested payloads', () => {
    const ex = new BrandGuideExtractor({});
    const inner = { company: { name: 'N' }, logo: {}, colorPalette: {} };
    assert.deepEqual(ex.unwrapAgentResult(inner), inner);
    assert.deepEqual(ex.unwrapAgentResult({ result_json: JSON.stringify(inner) }), inner);
    assert.throws(() => ex.unwrapAgentResult({ nope: 1 }), /did not match brand schema/);
  });
});
