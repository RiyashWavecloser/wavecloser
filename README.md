# Wave Closers — Operations Console

Internal PM / Ops / AI console for managing the onboarding, monitoring, and automation of Wave Closers users. Built per **Project Scope v2.2** (approved May 2026).

> **Status:** Prototype with placeholder data. Real benchmarks, API credentials, and contract/learning details to be swapped in once confirmed by William (scope §12).

---

## What this is

A React web app sitting on top of the existing `waveclosers.com` platform. Five connected modules:

| # | Module | Purpose |
|---|---|---|
| 1 | **Dashboard** | Live view of every user — leads, deals, status flags |
| 2 | **Onboarding Flow** | 6-step lead routing simulator per scope §5 |
| 3 | **AI Automation** | Claude running 9 background tasks; activity log |
| 4 | **Franchise Research** | Claude-powered market scoring for franchise placement |
| 5 | **Data Integration** | Dual-mode data layer — CSV upload + API sync |

Plus an **embedded Claude assistant** (top-right "Ask Claude" button) that has read access to the dashboard data.

---

## Quick start

```bash
# 1. install
npm install

# 2. (optional) start the Claude API proxy in a separate terminal
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY
node server/claude-proxy.js

# 3. run the frontend
npm run dev
```

The app opens at <http://localhost:5173>.

Without the proxy the UI still runs end-to-end — the **Ask Claude** assistant will just show a demo-mode message instead of calling the API.

---

## Project structure

```
wave-closers/
├── public/
│   └── favicon.svg
├── server/
│   └── claude-proxy.js          # Tiny Express proxy for the Anthropic API
├── src/
│   ├── App.jsx                  # Top-level layout + view router
│   ├── main.jsx                 # React entry
│   ├── components/              # Reusable UI
│   │   ├── AiAssistant.jsx      # Embedded Claude drawer
│   │   ├── Sidebar.jsx
│   │   ├── TopBar.jsx
│   │   ├── UserDrawer.jsx       # Detail drawer for one user
│   │   ├── UserTable.jsx
│   │   └── ui.jsx               # Primitives: Card, PageHeader, StatCard, StatusPill, Note
│   ├── modules/                 # One file per screen
│   │   ├── Dashboard.jsx
│   │   ├── OnboardingFlow.jsx
│   │   ├── AutomationPanel.jsx
│   │   ├── FranchiseResearch.jsx
│   │   └── DataIntegration.jsx
│   ├── data/
│   │   ├── constants.js         # User types, benchmarks, onboarding stages
│   │   └── seed.js              # Placeholder users, automation log, markets
│   ├── lib/
│   │   ├── claudeClient.js      # Talks to the proxy
│   │   └── status.js            # Status computation + formatters
│   └── styles/
│       └── global.css           # CSS variables + resets
├── .env.example
├── .eslintrc.json
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## The 4 user types and routing

Per the approved scope:

| User type | Earnings | Route after qualification |
|---|---|---|
| Referral Partner | $2,000 per closed restaurant | → Customer Experience |
| Independent Rep | $1,500–$3,000 + 40% residuals | → Customer Experience |
| Authorized Reseller | $1,500–$3,000 + 40% recurring + leads | → Recruiter / Franchise Sales → CX |
| ISO Investor (DONE FOR YOU) | Done-for-you investment partner | → Recruiter / Franchise Sales → CX |

All closed users go through CX for: **platform onboarding · contract · online learning · Thursday training invite**.

Defined in [`src/data/constants.js`](src/data/constants.js).

---

## Data modes

The console works in two modes, switchable in the Data Integration screen:

1. **CSV upload** — paste/export user data weekly from the Wave Closers dashboard. Works today.
2. **API sync** — direct connection to `waveclosers.com`. Slots are built and ready; activate once William confirms the API endpoint and credentials.

The active mode is just app state in `App.jsx` for the prototype. Persist it to a database / config service when going live.

---

## Configuration

Environment variables (see `.env.example`):

| Variable | Where | Purpose |
|---|---|---|
| `VITE_CLAUDE_PROXY_URL` | Frontend (Vite) | URL of the Claude proxy backend |
| `ANTHROPIC_API_KEY` | **Backend only** | Anthropic API key — never exposed to the browser |
| `PROXY_PORT` | Backend | Port for the proxy server |
| `WAVECLOSERS_API_URL` | Backend | Pending confirmation from William |
| `WAVECLOSERS_API_KEY` | Backend | Pending confirmation from William |

---

## Open items (scope §12)

These are pending William's confirmation and will unlock the final values in the code:

- [ ] Does `waveclosers.com` expose an API?
- [ ] Weekly lead targets per user type
- [ ] Monthly quota benchmarks per user type
- [ ] Contract template
- [ ] Online learning platform link
- [ ] Thursday meeting time
- [ ] Sales Manager role (new hire or existing team member?)

Placeholder values live in `src/data/constants.js` (`BENCHMARKS`) and `src/data/seed.js`. Replace those constants when answers arrive.

---

## Scripts

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Production build to ./dist
npm run preview  # Preview the production build
npm run lint     # ESLint
```

---

## Roadmap

Once William signs off the open items:

1. Swap real benchmarks into `src/data/constants.js`.
2. Wire the Wave Closers API (if available) — implementation goes in `src/lib/waveClosersClient.js` (not yet created).
3. Replace the in-memory user state with a real database (Airtable or Postgres).
4. Build out the Claude automations from the activity log into real triggered jobs.
5. Move the embedded assistant onto streaming responses for snappier UX.

---

## License

Internal. Not for redistribution.

---

**Maintainer:** Riyash (PM)
**Sponsor:** William
