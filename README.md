# Wave Closers — Operations Console + AI Lead Generation Engine

**v3.0** — Internal operations console for Wave Closers, a payment processing platform targeting restaurants and foot-traffic businesses. Manages four partner types (Referral, Rep, Reseller, ISO Investor) through a 6-step onboarding flow, runs 9 AI automations powered by Claude, and includes a full AI Lead Generation Engine (Module 6) that generates scored leads from Google Places + Yelp for 10 cold-calling agents at 100 leads/agent/day.

---

## 1. Quick Start

```bash
# Clone and install
git clone <repo-url>
cd wave-closers
npm install

# Start frontend only (demo mode — no API keys needed)
npm run dev
# → http://localhost:5173

# Start everything (frontend + backend + workers)
npm run dev:all
```

**Demo mode** works out of the box with zero environment variables. All features use seed data, emails log to console, leads show sample data saved to localStorage.

---

## 2. File Structure

```
wave-closers/
├── public/favicon.svg
├── server/
│   ├── claude-proxy.js          ← Express proxy (port 3001) + all API endpoints
│   ├── automationWorker.js      ← 9 automations + cron jobs (poll every 60s)
│   ├── leadWorker.js            ← Module 6: Google Places + Yelp + Claude scoring
│   ├── airtableClient.js        ← Airtable CRUD (Users, AutomationLog, Leads, Staff)
│   ├── emailService.js          ← Resend + all 7 email templates
│   ├── auth.js                  ← PBKDF2 hashing + HMAC-SHA256 tokens + RBAC
│   └── constants.js             ← Server-side benchmarks + lead gen constants
├── scripts/
│   ├── seed-staff.mjs           ← Seeds Staff table in Airtable
│   ├── hash-password.mjs        ← Password hashing utility
│   └── import-resellers.mjs     ← Bulk import script
├── src/
│   ├── App.jsx                  ← Root layout, global state, 8-page routing
│   ├── main.jsx
│   ├── components/
│   │   ├── Sidebar.jsx          ← 8 nav items (including Lead Generation)
│   │   ├── TopBar.jsx           ← Search + Ask Claude button
│   │   ├── UserDrawer.jsx       ← Slide-in user detail panel
│   │   ├── AiAssistant.jsx      ← Floating Claude chat
│   │   ├── UserTable.jsx        ← Reusable user table
│   │   └── ui.jsx               ← Card, PageHeader, StatCard, StatusPill, Note
│   ├── modules/
│   │   ├── Dashboard.jsx        ← Module 1: stat cards, charts, user table
│   │   ├── Users.jsx            ← Module 2: search, filter, add, export CSV
│   │   ├── OnboardingFlow.jsx   ← Module 3: 6-step flow, simulation, queue
│   │   ├── AutomationPanel.jsx  ← Module 4: 9 automations, live log, email preview
│   │   ├── FranchiseResearch.jsx← Module 5: Claude-powered market scoring
│   │   ├── LeadGeneration.jsx   ← Module 6: AI lead gen engine (NEW)
│   │   ├── DataIntegration.jsx  ← CSV import/export + API sync
│   │   ├── Settings.jsx         ← Module 7: health check, open items, team, env vars
│   │   ├── Login.jsx            ← Auth login with forgot password
│   │   └── ChangePassword.jsx   ← First-login password change
│   ├── data/
│   │   ├── constants.js         ← USER_TYPES, BENCHMARKS, BUSINESS_TYPES, AGENTS, etc.
│   │   ├── seed.js              ← 12 users + log + markets + 20 sample leads
│   │   └── roles.js             ← 6 roles, view permissions, user filters
│   ├── lib/
│   │   ├── claudeClient.js      ← askClaude() → proxy
│   │   ├── dataLayer.js         ← All API client functions + localStorage persistence
│   │   ├── csvParser.js         ← parseCSV() + CSV_TEMPLATE
│   │   └── status.js            ← computeStatus(), formatNumber(), formatToday()
│   └── styles/global.css
├── .env.example
├── .eslintrc.json
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 3. Airtable Setup

Create **4 tables** in your Airtable base:

### Table: Users
| Field | Type | Notes |
|-------|------|-------|
| ID | Single line text | Wave Closers ID (e.g. WC-1001) |
| Name | Single line text | |
| Type | Single select | Options: REFERRAL, REP, RESELLER, ISO |
| Stage | Number | 1–6 |
| LeadsThisWeek | Number | |
| DealsThisMonth | Number | |
| Joined | Date | |
| Market | Single line text | e.g. "Brooklyn, NY" |
| Email | Email | |
| Notes | Long text | |

### Table: AutomationLog
| Field | Type | Notes |
|-------|------|-------|
| Task | Single line text | e.g. "Welcome email" |
| Target | Single line text | e.g. "Maya Chen (Referral)" |
| Status | Single select | Options: sent, ok, alert, error |
| Timestamp | Date & time | Auto-populated by worker |

### Table: Leads
| Field | Type | Notes |
|-------|------|-------|
| PlaceID | Single line text | Unique — Google Place ID or yelp-{id} |
| BusinessName | Single line text | |
| Type | Single line text | restaurant, beauty_salon, nail_salon, deli, massage, small_retail |
| Address | Single line text | |
| Phone | Single line text | |
| Website | URL | |
| Rating | Number | 0–5 |
| ReviewCount | Number | |
| Score | Number | 0–100 (Claude-scored) |
| ScoreReason | Single line text | 1-sentence explanation |
| Status | Single select | Options: New, Assigned, Called, Interested, NotInterested, Callback, NoAnswer |
| AssignedAgent | Single line text | |
| CalledAt | Date & time | |
| Outcome | Single line text | |
| Market | Single line text | |
| CreatedAt | Date & time | |

### Table: Staff
| Field | Type | Notes |
|-------|------|-------|
| Email | Email | Login email |
| Name | Single line text | |
| Role | Single select | admin, sponsor, cx, recruiter, marketer, trainer |
| PasswordHash | Single line text | PBKDF2 hash (set by seed:staff) |
| MustChangePassword | Checkbox | Force password change on first login |

---

## 4. Resend Setup + Namecheap DNS

### Resend
1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Copy your API key → set `RESEND_API_KEY` in `.env`
3. Add your sending domain in the Resend dashboard

### Namecheap DNS for Email Domain Verification
1. Log in to [Namecheap](https://www.namecheap.com) → Domain List → your domain → **Advanced DNS**
2. Add the **TXT record** provided by Resend:
   - Type: `TXT`
   - Host: `@` (or the subdomain Resend specifies)
   - Value: (the verification string from Resend dashboard)
   - TTL: Automatic
3. Add the **DKIM records** (usually 3 CNAME records):
   - Type: `CNAME`
   - Host: e.g. `resend._domainkey`
   - Value: (provided by Resend)
4. Wait 24–48 hours for DNS propagation
5. Verify in Resend dashboard → domain should show ✓ Verified
6. Set `EMAIL_FROM=ops@yourdomain.com` in `.env`

---

## 5. Google Places API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Navigate to **APIs & Services → Library**
4. Enable these APIs:
   - **Places API** (or Places API New)
   - **Place Details API** (included in Places API)
5. Go to **Credentials → Create Credentials → API Key**
6. Restrict the key:
   - Application restrictions: **None** (server-side only)
   - API restrictions: **Places API** only
7. Enable **Billing** (required for Places API — you get $200/month free credit)
8. Copy the key → set `GOOGLE_PLACES_API_KEY` in `.env`

**Rate limits:** 1 request/second. The lead worker handles this automatically.

---

## 6. Yelp Fusion API Setup

1. Go to [Yelp Fusion](https://fusion.yelp.com)
2. Create an app → Get your API key
3. Copy the key → set `YELP_API_KEY` in `.env`

**Limits:** 5,000 API calls/day on free tier.

---

## 7. Running claude-proxy.js

```bash
node server/claude-proxy.js
# → [Wave Closers Proxy] ✓ Running on http://localhost:3001
```

This is the main Express server. All API endpoints run here.

---

## 8. Running automationWorker.js

```bash
# Normal mode (polls Airtable every 60s, runs cron jobs)
node server/automationWorker.js

# Test mode (runs all 9 automations on a synthetic user, then exits)
node server/automationWorker.js --test-mode
```

---

## 9. Running leadWorker.js

```bash
# The lead worker is imported by claude-proxy.js — it doesn't need to run standalone.
# But you can test it:
node server/leadWorker.js --test-mode
```

---

## 10. Running All Together

```bash
# Option 1: Single command (recommended)
npm run dev:all
# Starts: Vite (cyan) + Express proxy (yellow) + Automation worker (magenta) + Lead worker (green)

# Option 2: Four separate terminals
npm run dev          # Terminal 1: Vite frontend → http://localhost:5173
npm run server       # Terminal 2: Express proxy → http://localhost:3001
npm run worker       # Terminal 3: Automation worker
npm run leads        # Terminal 4: Lead worker (only needed for standalone testing)
```

---

## 11. All Environment Variables

| Variable | Required | Description | Where to get |
|----------|----------|-------------|-------------|
| `VITE_CLAUDE_PROXY_URL` | Frontend | Express proxy URL | `http://localhost:3001/api/claude` locally |
| `ANTHROPIC_API_KEY` | Server | Claude AI API key | console.anthropic.com |
| `AIRTABLE_API_KEY` | Server | Airtable personal access token | airtable.com/create/tokens |
| `AIRTABLE_BASE_ID` | Server | Airtable base ID (starts with `app`) | Open base → Help → API docs |
| `RESEND_API_KEY` | Server | Resend email API key | resend.com |
| `EMAIL_FROM` | Server | Verified sender email | Must match Resend domain |
| `RIYASH_EMAIL` | Server | Reports recipient | Your email |
| `WILLIAM_EMAIL` | Server | Weekly reports recipient | William's email |
| `GOOGLE_PLACES_API_KEY` | Server | Google Places API key | console.cloud.google.com |
| `YELP_API_KEY` | Server | Yelp Fusion API key | fusion.yelp.com |
| `DAILY_LEADS_PER_AGENT` | Server | Target leads/agent/day (default: 100) | Adjust as needed |
| `NUM_AGENTS` | Server | Number of cold-calling agents (default: 10) | Update when team changes |
| `PORT` | Server | Express port (default: 3001) | Set in Railway |

---

## 12. The 10 Open Items

| # | Open Item | Blocks | File to Edit |
|---|-----------|--------|-------------|
| 1 | API availability from waveclosers.com | API sync mode | `.env` → `WAVECLOSERS_API_URL` + `WAVECLOSERS_API_KEY` |
| 2 | Weekly lead targets per user type | Lead-shortfall alerts | `src/data/constants.js` → `BENCHMARKS` + `server/constants.js` |
| 3 | Monthly quota benchmarks per user type | Quota-miss escalations | `src/data/constants.js` → `BENCHMARKS` + `server/constants.js` |
| 4 | Contract template for CX automation | Contract dispatch email | `.env` → `CONTRACT_TEMPLATE_URL` |
| 5 | Online learning platform link / login flow | Online learning enrollment | `.env` → `LEARNING_PLATFORM_URL` |
| 6 | Thursday sales training meeting time | Thursday training invite | `.env` → `THURSDAY_TRAINING_TIME` + `THURSDAY_TRAINING_LINK` |
| 7 | Sales Manager role (TBC) | Step 6 ownership | `src/data/constants.js` → `TEAM` array |
| 8 | Google Places API key | Live lead generation | `.env` → `GOOGLE_PLACES_API_KEY` |
| 9 | Yelp Fusion API key | Backup lead source | `.env` → `YELP_API_KEY` |
| 10 | Cold-calling agent roster (10 names) | Agent assignment | `src/data/constants.js` → `AGENTS` array |

Every pending item is a config change, not a code change. Swap takes < 5 minutes.

---

## 13. Deployment Guide (Vercel + Railway + Namecheap)

### Frontend → Vercel
1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Set environment variable: `VITE_CLAUDE_PROXY_URL=https://your-railway-url.railway.app/api/claude`
4. Deploy → get your Vercel URL

### Backend → Railway
1. Create new project in [Railway](https://railway.app)
2. Deploy `claude-proxy.js` as Service 1:
   - Start command: `node server/claude-proxy.js`
   - Set env vars: all server-side variables from §11
   - Set `START_WORKER=true` to auto-start automation worker
3. Set `ALLOWED_ORIGINS` to your Vercel domain

### DNS → Namecheap
1. Log in to Namecheap → Domain List → your domain → **Advanced DNS**
2. **Frontend subdomain** (ops.waveclosers.com):
   - Type: `CNAME`
   - Host: `ops`
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic
3. **Root domain** (if hosting frontend at root):
   - Type: `A`
   - Host: `@`
   - Value: Vercel IP (provided after deploy)
4. **Email verification** (for Resend):
   - Add TXT + CNAME records as described in §4
5. Wait 24–48 hours for propagation
6. Confirm domain in Vercel + Resend dashboards

---

## 14. Demo Mode

When no environment variables are set, the system runs in **full demo mode**:

- **Users**: 12 seed users with varied stages, types, and metrics
- **Leads**: 20 sample businesses across all types with varied scores
- **Automations**: Seed log entries, manual Run Now works locally
- **Emails**: Logged to console (full template text visible)
- **Franchise Research**: Example data or Claude-powered (if proxy running)
- **Lead Generation**: Demo data with simulated progress, outcomes saved to localStorage
- **Health Check**: Shows all services as offline with instructions

Switch to live mode by adding environment variables — **zero code changes needed**.
