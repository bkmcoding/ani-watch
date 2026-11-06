# Full Dependency Modernization & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade project dependencies across production, build, and test tooling to their modern, secure versions, resolving 19 security vulnerabilities (including CVEs in Axios, Vitest, Undici, and Hono) while ensuring type-checking, linting, building, and all 64 tests pass.

**Architecture:** Incrementally modernize dependencies in grouped layers: first fix baseline lint configuration and latent template escaping, upgrade production runtime and security overrides (Axios, Hono, Cheerio, Undici), upgrade testing and dev tools (TypeScript 5.9, Vitest 4.1.12), and upgrade ESLint/TS-ESLint flat configuration. Verify at each phase with `vitest`, `tsc`, and `esbuild`.

**Tech Stack:** Node.js 24+, Hono 4, Axios 1.21+, Cheerio 1.2+, Vitest 4.1.12+, TypeScript 5.9+, ESLint 9/10, Prettier 3.9+.

**Spec:** Dependency modernization requested by user to eliminate CVEs and modernize dev dependencies across ani.watch.

## Global Constraints

- Never break external API contracts or Vercel entrypoint bundling (`build-vercel.mjs` must succeed).
- Keep TypeScript within `<=5.9.x` (`<6.1.0`) to maintain full AST compatibility with `@typescript-eslint/parser`.
- Maintain all 64 existing unit/integration/security tests passing in Vitest.
- Ensure `npm audit` high/moderate vulnerabilities are resolved or strictly minimized.

---

### Task 1: Fix Baseline Lint Configuration & Template Escape Bug

**Files:**
- Modify: `eslint.config.js:1-40`
- Modify: `src/handlers/pages/browse.ts:2744,2944`

**Interfaces:**
- Produces: Clean baseline lint runner that properly ignores build artifacts (`api/**`, `test-results/**`) and scripts (`*.mjs`).

- [ ] **Step 1: Update `eslint.config.js` to ignore generated directories and script runners**

Add `'api/**', 'test-results/**', '**/*.mjs'` to the `ignores` block in `eslint.config.js`.

- [ ] **Step 2: Fix template escape characters in `src/handlers/pages/browse.ts`**

Change unescaped `\s` and `\d` to `\\s` and `\\d` at lines 2744 and 2944 inside the template literal so they properly evaluate to regex whitespace and digit character classes in generated client HTML.

- [ ] **Step 3: Run ESLint to verify baseline passes**

Run: `npm run lint`
Expected: PASS (0 errors).

---

### Task 2: Modernize Core Runtime Dependencies & Security Overrides

**Files:**
- Modify: `package.json:28-38,55-59`

**Interfaces:**
- Consumes: `axios`, `hono`, `@hono/node-server`, `cheerio`, `@vercel/speed-insights`, `undici` override.
- Produces: Hardened network & parsing stack free of Axios and Undici CVEs.

- [ ] **Step 1: Bump production dependencies and security overrides in `package.json`**

Update:
- `"axios": "^1.21.0"`
- `"hono": "^4.13.16"`
- `"@hono/node-server": "^1.19.18"`
- `"cheerio": "^1.2.0"`
- `"@vercel/speed-insights": "^2.1.0"`
- `"overrides": { "undici": "^6.29.1", "vite": "^8.3.5" }`

- [ ] **Step 2: Run `npm install` to update package-lock.json**

Run: `npm install`
Expected: Dependencies updated cleanly.

- [ ] **Step 3: Run test suite to verify runtime behavior**

Run: `npm test`
Expected: All 64 tests PASS.

---

### Task 3: Modernize Dev Tooling, TypeScript & Vitest

**Files:**
- Modify: `package.json:39-54`

**Interfaces:**
- Consumes: `typescript`, `vitest`, `@vitest/ui`, `@types/node`, `bun-types`, `prettier`, `globals`.
- Produces: Up-to-date testing and compilation toolchain.

- [ ] **Step 1: Update dev dependencies in `package.json`**

Update:
- `"typescript": "^5.9.3"`
- `"vitest": "^4.1.12"`
- `"@vitest/ui": "^4.1.12"`
- `"@types/node": "^25.9.9"`
- `"bun-types": "^1.4.4"`
- `"prettier": "^3.9.10"`
- `"eslint-plugin-prettier": "^5.5.7"`
- `"globals": "^17.14.0"`

- [ ] **Step 2: Run `npm install`**

Run: `npm install`
Expected: Installed with 0 conflicts.

- [ ] **Step 3: Verify TypeScript compiler and Vitest**

Run: `npm run type-check`
Expected: Exit code 0.
Run: `npm test`
Expected: 64 tests PASS.

---

### Task 4: Upgrade ESLint Flat Config Ecosystem

**Files:**
- Modify: `package.json:42,43,47,48`
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: `@typescript-eslint/parser@^8.72.1`, `@typescript-eslint/eslint-plugin@^8.72.1`, `eslint@^9.39.5`, `eslint-config-prettier@^10.1.8`.
- Produces: Modern ESLint 9+ flat configuration.

- [ ] **Step 1: Update ESLint dependencies in `package.json`**

Update:
- `"eslint": "^9.39.5"`
- `"@typescript-eslint/parser": "^8.72.1"`
- `"@typescript-eslint/eslint-plugin": "^8.72.1"`
- `"eslint-config-prettier": "^10.1.8"`

- [ ] **Step 2: Run `npm install`**

Run: `npm install`
Expected: Successfully installed.

- [ ] **Step 3: Adapt `eslint.config.js` for ESLint 9+ flat config rules**

Ensure compatibility with `@typescript-eslint` v8 rules and export flat array.

- [ ] **Step 4: Verify lint execution**

Run: `npm run lint`
Expected: 0 errors.

---

### Task 5: Final Validation, Vercel Build & Security Audit

**Files:**
- Verify: `package.json`, `package-lock.json`, `dist/`, `api/index.js`

- [ ] **Step 1: Run security audit**

Run: `npm audit`
Expected: Zero high/moderate vulnerabilities in project dependencies.

- [ ] **Step 2: Run full build pipeline**

Run: `npm run vercel-build`
Expected: `Bundled Vercel function → api/index.js` succeeds.

- [ ] **Step 3: Run comprehensive verification**

Run:
- `npm run type-check`
- `npm run lint`
- `npm test`
Expected: All checks PASS.
