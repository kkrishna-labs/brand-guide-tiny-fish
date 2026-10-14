import { spawn, execFile } from 'child_process';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Thin wrapper around the TinyFish CLI.
 * Docs: https://docs.tinyfish.ai/quickstart
 * Auth: TINYFISH_API_KEY (preferred) or TINY_FISH_API_KEY (legacy).
 */
export class TinyFishClient {
  constructor(apiKey = null) {
    this.apiKey =
      apiKey ||
      process.env.TINYFISH_API_KEY ||
      process.env.TINY_FISH_API_KEY ||
      null;
    if (!this.apiKey) {
      throw new Error(
        'TinyFish API key not found. Set TINYFISH_API_KEY environment variable (see .env.example).'
      );
    }
  }

  resolveBin() {
    if (this._bin) return this._bin;
    if (process.env.TINYFISH_BIN) return (this._bin = process.env.TINYFISH_BIN);
    // Git-Bash/MSYS provides a POSIX shell shim `tinyfish` (no extension).
    // Prefer it over tinyfish.cmd: it execs fine without a shell, while
    // .cmd needs cmd.exe quoting that breaks on spaces in the path.
    const posixDirs = (process.env.PATH || '').split(':');
    for (const dir of posixDirs) {
      try {
        const full = path.join(dir.replace(/^"|"$/g, ''), 'tinyfish');
        if (fs.existsSync(full)) {
          const st = fs.statSync(full);
          if (st.isFile()) return (this._bin = full);
        }
      } catch { /* ignore */ }
    }
    if (process.platform === 'win32') {
      const roots = [
        process.env.APPDATA && path.join(process.env.APPDATA, 'npm'),
        'C:\\Program Files\\nodejs',
      ].filter(Boolean);
      const names = ['tinyfish.cmd', 'tinyfish.exe'];
      const pathDirs = (process.env.PATH || '').split(';');
      for (const dir of [...pathDirs, ...roots, 'C:\\Users\\Krishna Kanojiya\\Dev\\Node\\global']) {
        for (const n of names) {
          try {
            const full = path.join(dir.replace(/^"|"$/g, ''), n);
            if (fs.existsSync(full)) return (this._bin = full);
          } catch { /* ignore */ }
        }
      }
      return (this._bin = 'tinyfish');
    }
    return (this._bin = 'tinyfish');
  }

  async runCommand(args) {
    // Windows + spaces in path: `tinyfish` is a .cmd shim, which Node can
    // only launch via cmd.exe with a fully-quoted command line.
    if (process.platform === 'win32') {
      return this.runCommandWindows(args);
    }
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        TINYFISH_API_KEY: this.apiKey,
        TINY_FISH_API_KEY: this.apiKey,
      };
      execFile('tinyfish', args, { env, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          const detail = ((stderr || stdout || err.message) || '').toString().trim();
          reject(new Error(`TinyFish CLI failed (code ${err.code}): ${detail}`));
          return;
        }
        const out = (stdout || '').toString().trim();
        if (!out) return resolve({});
        try {
          resolve(JSON.parse(out));
        } catch {
          resolve(out);
        }
      });
    });
  }

  runCommandWindows(args) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        TINYFISH_API_KEY: this.apiKey,
        TINY_FISH_API_KEY: this.apiKey,
      };
      const q = (s) => `"${String(s).replace(/"/g, '')}"`;
      const bin = this.resolveBin();
      // Whole command wrapped in an extra pair of quotes (cmd /s behavior):
      //   cmd.exe /d /s /c ""bin" "arg" "arg""
      const inner = `${q(bin)} ${args.map(q).join(' ')}`;
      const cmdline = `/d /s /c "${inner}"`;
      execFile(
        process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        [cmdline],
        { env, maxBuffer: 32 * 1024 * 1024, windowsVerbatimArguments: true, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            const detail = ((stderr || stdout || err.message) || '').toString().trim();
            reject(new Error(`TinyFish CLI failed (code ${err.code}): ${detail}`));
            return;
          }
          const out = (stdout || '').toString().trim();
          if (!out) return resolve({});
          try {
            resolve(JSON.parse(out));
          } catch {
            resolve(out);
          }
        }
      );
    });
  }

  async search(query, options = {}) {
    const args = ['search', 'query', query];
    
    if (options.includeDomains) {
      args.push('--include-domains', options.includeDomains.join(','));
    }
    if (options.excludeDomains) {
      args.push('--exclude-domains', options.excludeDomains.join(','));
    }
    if (options.location) {
      args.push('--location', options.location);
    }
    if (options.language) {
      args.push('--language', options.language);
    }
    if (options.page) {
      args.push('--page', options.page.toString());
    }

    return this.runCommand(args);
  }

  async fetchContent(urls, opts = {}) {
    if (!Array.isArray(urls)) urls = [urls];
    urls = urls.filter(Boolean);
    if (urls.length === 0) throw new Error('fetchContent: no URLs provided');
    if (urls.length > 10) {
      throw new Error('Maximum 10 URLs per fetch_content call');
    }

    const args = ['fetch', 'content', 'get', ...urls];
    args.push('--format', opts.format || 'markdown');
    if (opts.links !== false) args.push('--links');
    if (opts.imageLinks !== false) args.push('--image-links');
    if (opts.timeoutMs) args.push('--per-url-timeout-ms', String(opts.timeoutMs));

    const raw = await this.runCommand(args);
    if (raw && Array.isArray(raw.results)) return raw;
    if (Array.isArray(raw)) return { results: raw, errors: [] };
    return raw;
  }

  /** Fetch URLs in batches of 10. Returns { pages: Map, errors: [] }. */
  async fetchMany(urls, opts = {}) {
    const map = new Map();
    const errors = [];
    for (let i = 0; i < urls.length; i += 10) {
      const batch = urls.slice(i, i + 10);
      const raw = await this.fetchContent(batch, opts);
      for (const r of raw.results || []) {
        map.set(r.url, r);
        if (r.final_url && r.final_url !== r.url) map.set(r.final_url, r);
      }
      for (const e of raw.errors || []) errors.push(e);
    }
    return { pages: map, errors };
  }

  ensureSessionId(sessionId) {
    if (!sessionId) return uuidv4();
    if (!uuidValidate(sessionId)) {
      throw new Error(
        `Invalid session-id "${sessionId}": TinyFish requires a UUID.`
      );
    }
    return sessionId;
  }

  writeSchemaFile(sessionId, schema) {
    const file = path.join(os.tmpdir(), `tinyfish-schema-${sessionId}.json`);
    fs.writeFileSync(file, JSON.stringify(schema));
    return file;
  }

  async runAutomation(goal, url, options = {}) {
    const sessionId = this.ensureSessionId(options.sessionId);
    const args = [
      'agent', 'run', goal,
      '--url', url,
      '--session-id', sessionId,
      '--sync'
    ];

    let schemaFile = null;
    if (options.outputSchema) {
      schemaFile = this.writeSchemaFile(sessionId, options.outputSchema);
      args.push('--output-schema-file', schemaFile);
    }

    if (options.browserProfile) {
      args.push('--browser-profile', options.browserProfile);
    }

    if (options.maxSteps) args.push('--max-steps', String(options.maxSteps));
    if (options.maxDurationSeconds) args.push('--max-duration-seconds', String(options.maxDurationSeconds));
    if (options.mode) args.push('--mode', options.mode);
    if (options.noScreenshots) args.push('--no-capture-screenshots');

    if (options.proxyConfig) {
      args.push('--proxy-config', JSON.stringify(options.proxyConfig));
    }

    if (options.useProfile) {
      args.push('--use-profile');
      if (options.profileId) {
        args.push('--profile-id', options.profileId);
      }
    }

    if (options.useVault) {
      args.push('--use-vault');
      if (options.credentialItemIds) {
        for (const id of options.credentialItemIds) {
          args.push('--credential-item-id', id);
        }
      }
    }

    try {
      return await this.runCommand(args);
    } finally {
      if (schemaFile) {
        try { fs.unlinkSync(schemaFile); } catch { /* ignore */ }
      }
    }
  }

  async runAutomationAsync(goal, url, options = {}) {
    const sessionId = this.ensureSessionId(options.sessionId);
    const args = [
      'agent', 'run', goal,
      '--url', url,
      '--session-id', sessionId,
      '--async'
    ];

    let schemaFile = null;
    if (options.outputSchema) {
      schemaFile = this.writeSchemaFile(sessionId, options.outputSchema);
      args.push('--output-schema-file', schemaFile);
    }

    if (options.browserProfile) {
      args.push('--browser-profile', options.browserProfile);
    }

    try {
      return await this.runCommand(args);
    } finally {
      if (schemaFile) {
        try { fs.unlinkSync(schemaFile); } catch { /* ignore */ }
      }
    }
  }

  async getRun(runId) {
    const args = ['agent', 'run', 'get', runId];
    return this.runCommand(args);
  }

  async listRuns() {
    const args = ['agent', 'run', 'list'];
    return this.runCommand(args);
  }

  async cancelRun(runId) {
    const args = ['agent', 'run', 'cancel', runId];
    return this.runCommand(args);
  }

  async getWallet() {
    const args = ['wallet', 'status'];
    return this.runCommand(args);
  }
}

export async function createClient(apiKey = null) {
  return new TinyFishClient(apiKey);
}