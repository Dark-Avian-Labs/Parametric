# Parametric

A Warframe mod builder and build planner. Equip mods, arcanes, and Archon Shards, preview stat changes, and compare DPS across loadouts — all backed by live game data pulled from the official Warframe public exports and the Warframe Wiki.

## Tech Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Client   | React 19, React Router 7, Tailwind CSS 4, Vite 7 |
| Server   | Express 5, TypeScript, better-sqlite3            |
| Auth     | argon2, express-session, csrf-sync               |
| Tooling  | ESLint 9, Prettier, Vitest, GitHub Actions       |
| Runtime  | Node >= 25, PM2                                  |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **>= 25**
- npm (ships with Node)

### Install

```bash
git clone <repo-url> && cd Parametric
npm install
```

### Development

```bash
npm run dev
```

This starts both the Express API server (port 3001) and the Vite dev server (port 5173) concurrently. The Vite dev server proxies `/api`, `/icons`, and `/images` requests to the backend.

A `.env.development` file is included with `DEV_SKIP_AUTH=1` so you can work without authentication in local development.

### Production Build

```bash
npm run build   # compiles server (tsc) + client (vite)
npm start       # runs dist/server/index.js
```

## Environment Variables

Copy `.env.example` to `.env` and fill in production values:

| Variable                     | Required | Description                                         |
| ---------------------------- | -------- | --------------------------------------------------- |
| `NODE_ENV`                   | Yes      | `production` for deploys                            |
| `PORT`                       | No       | Server port (default `3001`)                        |
| `SESSION_SECRET`             | Yes      | Random string, 32+ chars (fatal if missing in prod) |
| `CENTRAL_DB_PATH`            | No       | Absolute path to shared central.db                  |
| `TRUST_PROXY`                | No       | `1` when behind nginx/caddy                         |
| `SECURE_COOKIES`             | No       | `1` for HTTPS cookie flag                           |
| `COOKIE_DOMAIN`              | No       | Domain for cross-subdomain session sharing          |
| `AUTH_MAX_ATTEMPTS`          | No       | Login attempts before lockout (default `5`)         |
| `AUTH_LOCKOUT_MINUTES`       | No       | Lockout duration (default `15`)                     |
| `AUTH_ATTEMPT_WINDOW_MINUTES`| No       | Sliding window for attempt counting (default `15`)  |
| `DEV_SKIP_AUTH`              | No       | `1` to disable auth locally (ignored in production) |

## Project Structure

```
Parametric/
├── client/                 # React SPA
│   ├── components/         # UI components
│   │   ├── Auth/           #   Login, registration, admin
│   │   ├── BuildOverview/  #   Build list and management
│   │   ├── Compare/        #   Side-by-side build comparison
│   │   ├── DataExplorer/   #   Browse imported game data
│   │   ├── Layout/         #   App shell and navigation
│   │   ├── ModBuilder/     #   Core build editor (mods, arcanes, shards)
│   │   └── ModCard/        #   Mod card rendering and animations
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Tailwind entry and custom CSS
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Client-side helpers (DPS calc, drain, parsing)
├── server/                 # Express API
│   ├── auth/               #   Authentication, middleware, validation
│   ├── db/                 #   SQLite connections and schemas
│   ├── import/             #   Game data import pipeline
│   ├── routes/             #   API route handlers
│   ├── scraping/           #   Wiki and Overframe data scrapers
│   └── types/              #   Server-side type declarations
├── data/                   # Runtime data (gitignored DBs and images)
├── icons/                  # Equipment and mod icons
├── .github/workflows/      # CI/CD (deploy, lint, format, test)
├── ecosystem.config.cjs    # PM2 process configuration
└── .env.example            # Environment variable reference
```

## Scripts

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start dev server + client concurrently     |
| `npm run build`      | Production build (server + client)         |
| `npm start`          | Run production server                      |
| `npm run lint`       | Run ESLint                                 |
| `npm run lint:fix`   | Run ESLint with auto-fix                   |
| `npm run format`     | Format all files with Prettier             |
| `npm run check-format` | Check formatting (CI)                   |
| `npm test`           | Run tests with Vitest                      |

## Deployment

The project deploys via GitHub Actions on push to `main`. The workflow:

1. Builds the server and client
2. Bundles `dist/` with production `node_modules`
3. Rsyncs to the server, preserving `data/`, `icons/`, `import/`, `logs/`, and `.env`
4. Restarts the PM2 process

First-time server setup requires manually placing `.env` and `ecosystem.config.cjs`.

## License

Private — not for redistribution.
