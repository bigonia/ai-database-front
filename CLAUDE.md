# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (choose environment)
npm run dev:test      # dev against test API (VITE_BASE_API=/)
npm run dev:prod      # dev against prod API (VITE_BASE_API=/api-prod)

# Build
npm run build:test
npm run build:prod

# Lint
npm run lint          # ESLint with auto-fix on .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts

# Preview built output
npm run preview       # port 4173
```

There is no test runner configured.

## Architecture

This is a Vue 3 + TypeScript admin dashboard (vue3-element-admin template), built with Element Plus, Pinia, and Vite. Hash-mode router with role-based access control.

### Build & environment

Four Vite modes map to `.env.*` files (`dev_test`, `dev_prod`, `build_test`, `build_prod`). The Vite dev server runs on port 8001 and proxies `/api` to `http://127.0.0.1:8080` and `/api-test` to `https://api.midfar.com/dspt_test/api`.

### Routing & permissions

- **constantRoutes** (`src/router/index.ts`) are always registered (dashboard, login, 404, redirect).
- **asyncRoutes** are loaded dynamically after login based on the user's roles (admin gets all, others are filtered via `filterAsyncRoutes`).
- `src/permission.ts` is the navigation guard — it checks token presence, fetches user info, generates accessible routes, and adds them to the router.
- Role checking uses route `meta.roles` arrays matched against the user's roles from the backend.

### State management (Pinia)

Store modules live in `src/store/modules/` and are auto-registered via `import.meta.glob` in `src/store/index.ts`.

- **app** — sidebar open/close, device type, UI size
- **user** — token, roles, name, avatar; login/logout/getInfo actions
- **permission** — filtered async routes
- **space** — current business space context (persisted to localStorage, injected as `X-Space-Id` header)
- **tagsView** — open page tabs
- **settings** — static UI feature flags from `src/settings.ts`

### API layer

`src/utils/request.js` is a configured Axios instance. Key behaviors:
- Injects `Authorization: Bearer <token>` header
- Injects `X-Space-Id` header from localStorage (space context for multi-tenant API)
- Expects response shape `{ code: 20000, data: ... }`; any other code is treated as an error
- Specific error codes (50008, 50012, 50014) trigger forced re-login
- Blob/octet-stream responses are returned raw (file downloads)

Individual API modules (`src/api/*.js`, `src/api/space.ts`) are plain functions returning request config objects.

### Layout

`src/layout/index.vue` composes Sidebar, Navbar, TagsView, AppMain (`<router-view>`), and Settings panel. The `@/` alias resolves to `src/`.

### Key views (lazy-loaded)

| Route | Path | Feature |
|---|---|---|
| Dashboard | `/dashboard` | Home page |
| Agent Management | `/agent/list` | Agent CRUD |
| AI Chat | `/ai-chat/index` | Chat interface |
| Datasource | `/datasource/list` | Database connections |
| SDUI Console | `/sdui/*` | Server-driven UI management (overview, devices, workflows, editor) |
| File Manager | `/file-ops/manager` | File operations |
| Domain Docs | `/domain-docs/list` | Domain documents |
| Knowledge Base | `/knowledge/list` | Vector store / knowledge base |

### Auto-imports

`unplugin-auto-import` and `unplugin-vue-components` auto-import Element Plus APIs. `ElMessage`, `ElMessageBox`, `ElLoading`, `ElNotification` are declared as ESLint globals — do not import them explicitly.

### SVG icons

SVG files in `src/icons/svg/` are auto-sprite'd via `@pivanov/vite-plugin-svg-sprite`. Use with `<svg-icon name="icon-name" />`.
