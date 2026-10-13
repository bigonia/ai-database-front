# Repository Guidelines

## Project Structure & Module Organization

This is a Vue 3 admin frontend using TypeScript, Element Plus, Pinia, and Vite.

- `src/views/` contains feature pages; SDUI business, terminal, agent, and debug screens live in `src/views/sdui/`.
- `src/components/` contains shared UI; keep feature-specific components and composables beside their pages.
- `src/api/` contains backend clients, `src/store/modules/` holds Pinia stores, and `src/router/` defines routes. Navigation guards live in `src/permission.ts`.
- `src/sdui/`, `src/types/`, and `src/utils/` contain domain logic, types, and utilities.
- Assets belong in `src/assets/`, SVG icons in `src/icons/svg/`, and static files in `public/`.
- `scripts/*.test.mjs` contains regression tests; `doc/sdui/` holds API, implementation, and acceptance documentation. Build output goes to `dist/`.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev:test` / `npm run dev:prod`: start Vite on port 8001 using the selected API environment.
- `npm run build:test` / `npm run build:prod`: generate the corresponding production bundle.
- `npm run preview`: serve the built bundle on port 4173.
- `npm run lint`: run ESLint with automatic fixes; inspect its changes before committing.
- `node --test scripts/*.test.mjs`: run all regression tests. Run one file for focused checks, e.g. `node --test scripts/terminal-runtime.test.mjs`.

## Coding Style & Naming Conventions

Follow `eslint.config.js`: two-space indentation, single-quoted JavaScript strings, semicolons, and no trailing commas. Prefer TypeScript and Vue Composition API with `<script setup lang="ts">` for new components. Use PascalCase component names, `useXxx.ts` composables, and descriptive kebab-case API modules. Use `@/` for imports from `src/`. Keep HTTP behavior in the shared Axios client, `src/utils/request.js`.

## Testing Guidelines

Tests use Node's `node:test` and `node:assert/strict`; name files `<feature>.test.mjs`. Cover changed behavior, failure handling, and asynchronous state where relevant. No coverage threshold is configured. For UI changes, also build the application and follow relevant checks in `doc/sdui/FRONTEND_MANUAL_ACCEPTANCE.md`.

## Commit & Pull Request Guidelines

History mixes short Chinese summaries with `feat:` and `fix:` prefixes. Write concise, action-oriented subjects focused on one change. PRs should explain behavior changes, link relevant issues, report validation commands and results, and include screenshots for UI changes. Document API or environment changes.

## Agent & Configuration Instructions

When upgrading or fixing features, redesign directly without preserving legacy channels or backward compatibility. Preserve unrelated working-tree changes. Vite modes use `.env.dev_test`, `.env.dev_prod`, `.env.build_test`, and `.env.build_prod`; never put secrets in client-exposed `VITE_*` variables.
