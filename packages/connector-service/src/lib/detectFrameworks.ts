// packages/connector-service/src/lib/detectFrameworks.ts
export type Detected = {
  frameworks: string[];          // e.g. ['nextjs', 'react', 'vite', 'vanilla-html']
  signals: {
    hasPackageJson: boolean;
    hasHtml: boolean;            // any *.html in repo
    hasSpaEntrypoint: boolean;   // src/main.{ts,tsx,js,jsx} or pages/_app etc.
    configFiles: string[];       // vite.config.*, next.config.*, svelte.config.*, angular.json, nuxt.config.*
  };
};

/**
 * A stronger framework detector:
 * - looks at deps + scripts in package.json (if present)
 * - looks at well-known config files (vite/next/svelte/angular/nuxt)
 * - looks at SPA entrypoints
 * - falls back to 'vanilla-html' when we see index.html (so you don't skip)
 */
export function detectFrameworks(pkg: any | null, allPaths: string[]): Detected {
  const found = new Set<string>();
  const signals: Detected['signals'] = {
    hasPackageJson: !!pkg,
    hasHtml: allPaths.some(p => p.toLowerCase().endsWith('.html')),
    hasSpaEntrypoint: false,
    configFiles: [],
  };

  const lower = (s: string) => s.toLowerCase();
  const has = (name: string) => allPaths.some(p => p === name || p.endsWith('/' + name));
  const hasAny = (globs: string[]) => allPaths.some(p => globs.some(g => matchEnd(p, g)));

  function matchEnd(p: string, pattern: string) {
    // simple suffix matcher like *.config.ts or pages/_app.tsx
    if (pattern.startsWith('*')) return lower(p).endsWith(lower(pattern.slice(1)));
    return lower(p).endsWith(lower(pattern));
  }

  // --- look at package.json deps + scripts
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {})
  };
  const scripts = pkg?.scripts ? JSON.stringify(pkg.scripts).toLowerCase() : '';

  const hasDep = (d: string) => !!deps[d];
  const scriptsLike = (re: RegExp) => re.test(scripts);

  if (hasDep('next') || scriptsLike(/next/)) found.add('nextjs');
  if (hasDep('react')) found.add('react');
  if (hasDep('react-router') || hasDep('react-router-dom')) found.add('react-router');
  if (hasDep('vite') || scriptsLike(/vite/)) found.add('vite');
  if (hasDep('vue') || scriptsLike(/nuxt|vue/)) found.add('vue');
  if (hasDep('@angular/core') || scriptsLike(/\bng\b/)) found.add('angular');
  if (hasDep('svelte') || scriptsLike(/svelte/)) found.add('svelte');

  // --- config files on disk
  const configCandidates = [
    'next.config.js','next.config.mjs','next.config.ts',
    'vite.config.js','vite.config.mjs','vite.config.ts',
    'svelte.config.js','svelte.config.mjs','svelte.config.ts',
    'angular.json',
    'nuxt.config.js','nuxt.config.mjs','nuxt.config.ts'
  ];
  configCandidates.forEach(file => { if (has(file)) signals.configFiles.push(file); });

  if (signals.configFiles.some(f => f.startsWith('next.'))) found.add('nextjs');
  if (signals.configFiles.some(f => f.startsWith('vite.'))) found.add('vite');
  if (signals.configFiles.some(f => f.startsWith('svelte.'))) found.add('svelte');
  if (signals.configFiles.includes('angular.json')) found.add('angular');
  if (signals.configFiles.some(f => f.startsWith('nuxt.'))) found.add('vue');

  // --- SPA entrypoints (very indicative even without deps)
  const spaEntrypoints = [
    'src/main.ts','src/main.tsx','src/main.js','src/main.jsx',
    'pages/_app.tsx','pages/_app.js',
    'app/layout.tsx','app/layout.js'
  ];
  if (hasAny(spaEntrypoints)) signals.hasSpaEntrypoint = true;

  // Heuristic: if we see SPA entrypoints but no deps detected, assume React/Vite style
  if (signals.hasSpaEntrypoint) {
    if (!found.has('react') && !found.has('nextjs')) found.add('react');
    if (!found.has('vite') && (has('index.html') || hasAny(['index.html','public/index.html']))) found.add('vite');
  }

  // --- Vanilla HTML fallback
  if (signals.hasHtml && found.size === 0) {
    // Treat as a simple frontend; this prevents "skip(non-FE)" on pure HTML sites.
    found.add('vanilla-html');
  }

  return { frameworks: Array.from(found), signals };
}

