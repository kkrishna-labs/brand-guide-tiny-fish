#!/usr/bin/env node
/** Brand Guide Generator — website in, brand guide out (TinyFish). */
import 'dotenv/config';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { TinyFishClient } from './tinyfish-client.js';
import { BrandGuideExtractor } from './brand-extractor.js';
import { toMarkdown, toHTML, toDesignTokens } from './format.js';

const program = new Command();
program
  .name('brand-guide')
  .description('Generate a brand guide (logo, palette, typography, tone, key messaging) from a company website or name using TinyFish.')
  .argument('<website>', 'Company website URL or company name, e.g. https://stripe.com or "Patagonia"')
  .option('--mode <mode>', 'fast (free, default) | content (paid agent on fetched text) | full (paid browser agent)', 'fast')
  .option('--format <fmt>', 'json (default) | markdown | html | tokens | all', 'json')
  .option('-o, --out <dir>', 'Output directory', './output')
  .option('--pretty', 'Pretty-print JSON', true)
  .action(async (website, opts) => {
    const t0 = Date.now();
    const client = new TinyFishClient();
    const extractor = new BrandGuideExtractor(client);
    const guide = await extractor.extract(website, { mode: opts.mode });

    const host = (() => { try { return new URL(guide.company.website).hostname.replace(/^www\./, ''); } catch { return 'site'; } })();
    fs.mkdirSync(opts.out, { recursive: true });
    const wrote = [];

    const formats = opts.format === 'all' ? ['json', 'markdown', 'html', 'tokens'] : [opts.format];
    for (const f of formats) {
      if (f === 'json') {
        const p = path.join(opts.out, `${host}.brand.json`);
        fs.writeFileSync(p, JSON.stringify(guide, null, 2));
        wrote.push(p);
      } else if (f === 'markdown' || f === 'md') {
        const p = path.join(opts.out, `${host}.brand.md`);
        fs.writeFileSync(p, toMarkdown(guide));
        wrote.push(p);
      } else if (f === 'html') {
        const p = path.join(opts.out, `${host}.brand.html`);
        fs.writeFileSync(p, toHTML(guide));
        wrote.push(p);
      } else if (f === 'tokens') {
        const p = path.join(opts.out, `${host}.tokens.json`);
        fs.writeFileSync(p, JSON.stringify(toDesignTokens(guide), null, 2));
        wrote.push(p);
      } else {
        console.error(`Unknown format: ${f} (use json|markdown|html|tokens|all)`);
        process.exitCode = 1;
      }
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone in ${secs}s — mode=${opts.mode}`);
    console.log(`Company: ${guide.company?.name} | logo: ${guide.logo?.primaryUrl ? 'yes' : 'no'} | ` +
      `colors: ${(guide.colorPalette?.primary || []).length + (guide.colorPalette?.secondary || []).length} | ` +
      `fonts: ${(guide.typography?.cssFontFamilies || []).length} | tone: ${(guide.toneOfVoice?.attributes || []).join(', ') || 'n/a'}`);
    console.log('Wrote:');
    wrote.forEach((w) => console.log('  ' + w));
  });

program
  .command('wallet')
  .description('Show TinyFish wallet balance')
  .action(async () => {
    const client = new TinyFishClient();
    console.log(JSON.stringify(await client.getWallet(), null, 2));
  });

program.parseAsync(process.argv);
