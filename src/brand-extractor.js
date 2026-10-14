import { TinyFishClient } from './tinyfish-client.js';
import { localExtract } from './local-extract.js';
import { enrichWithRawHtml } from './raw-html.js';

export const BRAND_GUIDE_SCHEMA = {
  type: 'object',
  properties: {
    company: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        website: { type: 'string' },
        tagline: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true }
      },
      required: ['name', 'website', 'tagline', 'description']
    },
    logo: {
      type: 'object',
      properties: {
        primaryUrl: { type: 'string', nullable: true },
        secondaryUrl: { type: 'string', nullable: true },
        faviconUrl: { type: 'string', nullable: true },
        formats: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['primaryUrl', 'secondaryUrl', 'faviconUrl', 'formats']
    },
    colorPalette: {
      type: 'object',
      properties: {
        primary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              hex: { type: 'string' },
              rgb: { type: 'string', nullable: true },
              usage: { type: 'string', nullable: true }
            },
            required: ['name', 'hex', 'rgb', 'usage']
          }
        },
        secondary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              hex: { type: 'string' },
              rgb: { type: 'string', nullable: true },
              usage: { type: 'string', nullable: true }
            },
            required: ['name', 'hex', 'rgb', 'usage']
          }
        },
        neutral: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              hex: { type: 'string' },
              rgb: { type: 'string', nullable: true },
              usage: { type: 'string', nullable: true }
            },
            required: ['name', 'hex', 'rgb', 'usage']
          }
        },
        accent: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              hex: { type: 'string' },
              rgb: { type: 'string', nullable: true },
              usage: { type: 'string', nullable: true }
            },
            required: ['name', 'hex', 'rgb', 'usage']
          }
        },
        cssVariables: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['primary', 'secondary', 'neutral', 'accent', 'cssVariables']
    },
    typography: {
      type: 'object',
      properties: {
        headings: {
          type: 'object',
          properties: {
            fontFamily: { type: 'string', nullable: true },
            fontWeight: { type: 'string', nullable: true },
            fontSize: { type: 'string', nullable: true },
            lineHeight: { type: 'string', nullable: true },
            letterSpacing: { type: 'string', nullable: true }
          },
          required: ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing']
        },
        body: {
          type: 'object',
          properties: {
            fontFamily: { type: 'string', nullable: true },
            fontWeight: { type: 'string', nullable: true },
            fontSize: { type: 'string', nullable: true },
            lineHeight: { type: 'string', nullable: true },
            letterSpacing: { type: 'string', nullable: true }
          },
          required: ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing']
        },
        accent: {
          type: 'object',
          properties: {
            fontFamily: { type: 'string', nullable: true },
            fontWeight: { type: 'string', nullable: true },
            fontSize: { type: 'string', nullable: true },
            lineHeight: { type: 'string', nullable: true },
            letterSpacing: { type: 'string', nullable: true }
          },
          required: ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing']
        },
        fontUrls: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        },
        cssFontFamilies: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['headings', 'body', 'accent', 'fontUrls', 'cssFontFamilies']
    },
    toneOfVoice: {
      type: 'object',
      properties: {
        attributes: {
          type: 'array',
          items: { type: 'string' }
        },
        description: { type: 'string', nullable: true },
        examplePhrases: {
          type: 'array',
          items: { type: 'string' }
        },
        doAndDont: {
          type: 'object',
          properties: {
            do: { type: 'array', items: { type: 'string' } },
            dont: { type: 'array', items: { type: 'string' } }
          },
          required: ['do', 'dont']
        },
        writingStyle: {
          type: 'object',
          properties: {
            formality: { type: 'string', enum: ['very-formal', 'formal', 'neutral', 'casual', 'very-casual'], nullable: true },
            technicality: { type: 'string', enum: ['very-technical', 'technical', 'accessible', 'simple'], nullable: true },
            emotion: { type: 'string', enum: ['very-emotional', 'emotional', 'balanced', 'rational', 'very-rational'], nullable: true }
          },
          required: ['formality', 'technicality', 'emotion']
        }
      },
      required: ['attributes', 'description', 'examplePhrases', 'doAndDont', 'writingStyle']
    },
    brandElements: {
      type: 'object',
      properties: {
        mission: { type: 'string', nullable: true },
        vision: { type: 'string', nullable: true },
        values: {
          type: 'array',
          items: { type: 'string' }
        },
        personality: {
          type: 'array',
          items: { type: 'string' }
        },
        audience: { type: 'string', nullable: true },
        differentiators: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['mission', 'vision', 'values', 'personality', 'audience', 'differentiators']
    },
    imagery: {
      type: 'object',
      properties: {
        style: { type: 'string', nullable: true },
        exampleUrls: {
          type: 'array',
          items: { type: 'string' }
        },
        guidelines: { type: 'string', nullable: true }
      },
      required: ['style', 'exampleUrls', 'guidelines']
    },
    extractedAt: { type: 'string', format: 'date-time' },
    sourceUrls: {
      type: 'array',
      items: { type: 'string' }
    },
    confidence: {
      type: 'object',
      properties: {
        logo: { type: 'number', minimum: 0, maximum: 1 },
        colors: { type: 'number', minimum: 0, maximum: 1 },
        typography: { type: 'number', minimum: 0, maximum: 1 },
        tone: { type: 'number', minimum: 0, maximum: 1 },
        overall: { type: 'number', minimum: 0, maximum: 1 }
      },
      required: ['logo', 'colors', 'typography', 'tone', 'overall']
    }
  },
  required: ['company', 'logo', 'colorPalette', 'typography', 'toneOfVoice', 'brandElements', 'imagery', 'extractedAt', 'sourceUrls', 'confidence']
};

const EXTRACTION_GOAL = `
Extract comprehensive brand guide information from this website. Focus on:

1. LOGO: Find the primary logo (usually in header/nav), secondary logo variations, and favicon. Note URLs and formats (SVG, PNG, etc.).

2. COLOR PALETTE: Extract ALL colors from CSS custom properties (--color-*, --primary-*, etc.), CSS variables, inline styles, and computed styles. Look for:
   - Primary brand colors
   - Secondary/supporting colors  
   - Neutral colors (grays, whites, blacks)
   - Accent colors
   - CSS variable names and their values

3. TYPOGRAPHY: Extract font families, weights, sizes, line heights from:
   - CSS @font-face declarations
   - font-family declarations on headings (h1-h6) and body
   - Google Fonts / Adobe Fonts / other font service URLs
   - Computed styles on key elements

4. TONE OF VOICE: Analyze the written content for:
   - Key attributes (professional, friendly, innovative, authoritative, playful, etc.)
   - Example phrases/headlines that exemplify the voice
   - Do's and Don'ts for writing style
   - Formality level, technicality, emotional resonance

5. BRAND ELEMENTS: Extract:
   - Mission statement
   - Vision statement
   - Core values
   - Brand personality traits
   - Target audience
   - Key differentiators/USPs

6. IMAGERY STYLE: Note photography/illustration style, example image URLs, any stated guidelines

INSTRUCTIONS:
- Start on the homepage, then navigate to About, Brand, Style Guide, or Press pages if they exist
- Close cookie banners, modals, or overlays before extracting
- Do NOT click purchase, sign-up, contact, or download buttons
- If a style guide/brand page exists, prioritize it
- Extract CSS variables by inspecting :root or html styles
- For colors, provide hex, rgb, and usage context
- For fonts, provide family, weight, size, line-height
- Return ONLY the JSON matching the output schema
- If something cannot be found, use null or empty arrays - do not guess
`;

const FALLBACK_EXTRACTION_GOAL = `
Extract brand information from this webpage content. Focus on:

1. LOGO: Find logo image URLs in the header/navigation area
2. COLORS: Extract any visible color hex codes, CSS variables, or color references in the content
3. TYPOGRAPHY: Note any font families mentioned or visible in style attributes
4. TONE: Analyze the writing style and key phrases on the page
5. BRAND ELEMENTS: Look for mission, vision, values, about us content

Return structured JSON matching the output schema. Use null for missing data.
`;

export class BrandGuideExtractor {
  constructor(client) {
    this.client = client;
    this.sourceUrls = new Set();
  }

  async extract(websiteUrl, opts = {}) {
    const mode = opts.mode || 'fast'; // 'fast' (free) | 'full' (paid agent) | 'content' (paid agent on fetched text)
    console.log(`Starting brand guide extraction for: ${websiteUrl} (mode=${mode})`);

    const normalizedUrl = this.normalizeUrl(websiteUrl);
    this.sourceUrls.add(normalizedUrl);

    try {
      const homepage = await this.fetchHomepage(normalizedUrl);
      const keyUrls = await this.discoverKeyPages(normalizedUrl, homepage);

      const pages = await this.fetchKeyPages(keyUrls);

      let brandGuide;
      if (mode === 'full') {
        brandGuide = await this.runFullAgentExtraction(normalizedUrl);
      } else if (mode === 'content') {
        brandGuide = await this.contentBasedExtraction(normalizedUrl, this.combineContent(pages));
      } else {
        brandGuide = await this.fastExtraction(normalizedUrl, pages);
      }

      return this.finalizeBrandGuide(brandGuide, normalizedUrl);
    } catch (error) {
      console.error('Extraction failed:', error.message);
      return this.createFallbackGuide(normalizedUrl, error.message);
    }
  }

  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.href.replace(/\/$/, '');
    } catch {
      return `https://${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
    }
  }

  async fetchHomepage(url) {
    console.log(`Fetching homepage: ${url}`);
    const raw = await this.client.fetchContent([url]);
    this.sourceUrls.add(url);
    const page = (raw.results || [])[0] || null;
    if (page?.final_url) this.sourceUrls.add(page.final_url);
    return page;
  }

  async discoverKeyPages(baseUrl, homepage) {
    const keyPaths = [
      '/about', '/about-us', '/company', '/brand', '/brand-guidelines',
      '/style-guide', '/design-system', '/press', '/media', '/newsroom',
      '/our-story', '/mission', '/values', '/culture'
    ];

    // 1) Prefer links actually present on the homepage (same-origin).
    const discovered = [baseUrl];
    try {
      const links = homepage?.links || [];
      const origin = new URL(baseUrl).origin;
      const wanted = ['about', 'brand', 'style', 'design', 'press', 'media', 'newsroom', 'story', 'mission', 'value', 'culture', 'company'];
      for (const href of links) {
        try {
          const u = new URL(href, baseUrl);
          if (u.origin !== origin) continue;
          const p = u.pathname.toLowerCase();
          if (wanted.some((w) => p.includes(w)) && !discovered.includes(u.origin + u.pathname.replace(/\/$/, ''))) {
            discovered.push(u.origin + u.pathname.replace(/\/$/, ''));
          }
        } catch { /* ignore bad hrefs */ }
        if (discovered.length >= 8) break;
      }
    } catch { /* ignore */ }

    // 2) Probe conventional paths to fill up to 8 (batched, cheap — fetch is free).
    const probes = [];
    for (const p of keyPaths) {
      const fullUrl = `${baseUrl}${p}`;
      if (!discovered.includes(fullUrl) && discovered.length + probes.length < 8) probes.push(fullUrl);
    }
    if (probes.length > 0) {
      try {
        const { pages } = await this.client.fetchMany(probes);
        for (const fullUrl of probes) {
          const page = pages.get(fullUrl);
          const text = page?.text || '';
          if (text && text.length > 1000) {
            discovered.push(fullUrl);
            this.sourceUrls.add(page.final_url || fullUrl);
            console.log(`Found key page: ${fullUrl}`);
          }
          if (discovered.length >= 8) break;
        }
      } catch { /* probing is best-effort */ }
    }

    return discovered.slice(0, 8);
  }

  async fetchKeyPages(urls) {
    console.log(`Fetching ${urls.length} key pages (markdown + html)...`);
    const [md, html] = await Promise.all([
      this.client.fetchMany(urls, { format: 'markdown', links: true, imageLinks: true }),
      this.client.fetchMany(urls, { format: 'html', links: false, imageLinks: false }),
    ]);
    const pages = [];
    for (const url of urls) {
      const m = md.pages.get(url) || null;
      const h = html.pages.get(url) || null;
      if (m) this.sourceUrls.add(m.final_url || url);
      if (m || h) pages.push({ url, markdown: m, html: h });
    }
    return pages;
  }

  async runFullAgentExtraction(baseUrl) {
    console.log(`Running full browser-agent extraction (paid)...`);
    const { v4: uuidv4 } = await import('uuid');
    const result = await this.client.runAutomation(
      EXTRACTION_GOAL,
      baseUrl,
      {
        outputSchema: BRAND_GUIDE_SCHEMA,
        browserProfile: 'lite',
        sessionId: uuidv4(),
      }
    );
    return this.unwrapAgentResult(result);
  }

  unwrapAgentResult(result) {
    if (!result) throw new Error('Agent returned no result');
    if (result.company || result.logo || result.colorPalette) return result;
    // CLI --sync responses sometimes nest under result_json / result / data / output
    for (const key of ['result_json', 'result', 'data', 'output', 'payload']) {
      const nested = result[key];
      if (typeof nested === 'string') {
        try {
          const parsed = JSON.parse(nested);
          if (parsed.company || parsed.logo || parsed.colorPalette) return parsed;
        } catch { /* not JSON, keep looking */ }
      } else if (nested && typeof nested === 'object') {
        if (nested.company || nested.logo || nested.colorPalette) return nested;
      }
    }
    throw new Error(`Agent result did not match brand schema: ${JSON.stringify(result).substring(0, 500)}`);
  }

  localExtraction(baseUrl, pages) {
    console.log('Running local heuristic extraction (free, no agent)...');
    return localExtract(baseUrl, pages);
  }

  async fastExtraction(baseUrl, pages) {
    const guide = this.localExtraction(baseUrl, pages);
    try {
      const stats = await enrichWithRawHtml(baseUrl, guide);
      console.log(`Raw-HTML enrichment: +${stats.colorsAdded} colors, ${stats.fontsAdded} font signals` +
        (stats.navLogo ? `, nav logo` : '') + (stats.favicon ? `, favicon` : ''));
    } catch (e) {
      console.log(`Raw-HTML enrichment skipped: ${e.message}`);
    }
    return guide;
  }

  combineContent(pages) {
    if (typeof pages === 'string') return pages;
    if (!Array.isArray(pages)) return '';
    return pages
      .map((p) => {
        const t = p.markdown?.text || '';
        const title = p.markdown?.title ? `# ${p.markdown.title}\n` : '';
        return `## ${p.url}\n${title}${t}`.trim();
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
  }

  async contentBasedExtraction(baseUrl, content) {
    console.log(`Running content-based agent extraction (paid)...`);
    const { v4: uuidv4 } = await import('uuid');
    const prompt = `
${FALLBACK_EXTRACTION_GOAL}

WEBSITE CONTENT:
${content.substring(0, 50000)}

BASE URL: ${baseUrl}
`;

    try {
      const result = await this.client.runAutomation(
        prompt,
        baseUrl,
        {
          outputSchema: BRAND_GUIDE_SCHEMA,
          browserProfile: 'lite',
          sessionId: uuidv4(),
        }
      );
      return this.unwrapAgentResult(result);
    } catch (error) {
      throw new Error(`Content-based extraction failed: ${error.message}`);
    }
  }

  finalizeBrandGuide(guide, baseUrl) {
    const now = new Date().toISOString();
    
    return {
      ...guide,
      company: {
        ...guide.company,
        website: baseUrl
      },
      extractedAt: now,
      sourceUrls: Array.from(this.sourceUrls),
      confidence: guide.confidence || this.calculateConfidence(guide)
    };
  }

  calculateConfidence(guide) {
    let scores = { logo: 0, colors: 0, typography: 0, tone: 0 };
    
    if (guide.logo?.primaryUrl) scores.logo = 0.8;
    if (guide.colorPalette?.primary?.length > 0) scores.colors = 0.7;
    if (guide.typography?.headings?.fontFamily) scores.typography = 0.6;
    if (guide.toneOfVoice?.attributes?.length > 0) scores.tone = 0.7;
    
    const overall = (scores.logo + scores.colors + scores.typography + scores.tone) / 4;
    
    return { ...scores, overall: Math.round(overall * 100) / 100 };
  }

  createFallbackGuide(baseUrl, error) {
    return {
      company: {
        name: null,
        website: baseUrl,
        tagline: null,
        description: null
      },
      logo: { primaryUrl: null, secondaryUrl: null, faviconUrl: null, formats: [] },
      colorPalette: { primary: [], secondary: [], neutral: [], accent: [], cssVariables: [] },
      typography: { 
        headings: { fontFamily: null, fontWeight: null, fontSize: null, lineHeight: null, letterSpacing: null },
        body: { fontFamily: null, fontWeight: null, fontSize: null, lineHeight: null, letterSpacing: null },
        accent: { fontFamily: null, fontWeight: null, fontSize: null, lineHeight: null, letterSpacing: null },
        fontUrls: [], cssFontFamilies: []
      },
      toneOfVoice: { 
        attributes: [], description: null, examplePhrases: [], 
        doAndDont: { do: [], dont: [] },
        writingStyle: { formality: 'neutral', technicality: 'accessible', emotion: 'balanced' }
      },
      brandElements: { mission: null, vision: null, values: [], personality: [], audience: null, differentiators: [] },
      imagery: { style: null, exampleUrls: [], guidelines: null },
      extractedAt: new Date().toISOString(),
      sourceUrls: Array.from(this.sourceUrls),
      confidence: { logo: 0, colors: 0, typography: 0, tone: 0, overall: 0 },
      error
    };
  }
}

export async function createExtractor(apiKey = null) {
  const client = new TinyFishClient(apiKey);
  return new BrandGuideExtractor(client);
}