# Wave Closers — Operations Console + AI Lead Generation Engine

**v4.0** — Internal operations console for Wave Closers, a payment processing platform targeting restaurants and foot-traffic businesses. Supports dual workflows (POS leads vs Recruiter onboarding), dynamically manages 9 team roles through a 7-step CX onboarding flow, runs background AI automations powered by Claude, and includes a Merchant Lead Generation engine with global deduplication and role-aware agent portals.

---

## 1. Workflows A & B

### Workflow A: Merchant / POS Leads
- **Cold Callers, Independent Reps, and Authorized Resellers** log in, view their assigned leads, call businesses, mark outcomes, and move deals through the POS sales pipeline.
- **Authorized Resellers** have priority access to fresh leads.
- Leads are globally deduplicated across all agents, ensuring no business is ever called twice.

### Workflow B: Recruiting / Salesperson Onboarding
- **Recruiter (Aureliab)** finds potential reps/partners externally (LinkedIn, referrals, etc.) and manually enters them into the system.
- Recruiter manages candidates through a recruitment pipeline: `New` → `Contacted` → `Interested` → `Onboarding` → `Active` / `Declined`.
- Setting a candidate to `Onboarding` automatically routes them to **Mildred (CX)**, who guides them through the 7-step platform onboarding flow.
- Setting a candidate to `Active` automatically creates a full system account for them in the `Users (Orca)` table.

---

## 2. File Structure

```
wave-closers/
├── public/favicon.svg
├── server/
│   ├── claude-proxy.js          ← Express proxy (port 3001) + all API endpoints
│   ├── automationWorker.js      ← Background automations + cron jobs (poll every 60s)
│   ├── leadWorker.js            ← Google Places + Yelp + Claude lead scoring
│   ├── airtableClient.js        ← Airtable CRUD (Users, AutomationLog, Leads, Staff, RecruitingPipeline)
│   ├── emailService.js          ← Resend + all email templates
│   ├── auth.js                  ← PBKDF2 hashing + HMAC-SHA256 tokens + RBAC permissions
│   └── constants.js             ← Server-side benchmarks + lead gen constants
├── scripts/
│   ├── seed-staff.mjs           ← Seeds Staff table in Airtable (16 accounts: 6 staff + 9 agents + 1 supervisor)
│   ├── hash-password.mjs        ← Password hashing utility
│   └── import-resellers.mjs     ← Bulk import script
├── src/
│   ├── App.jsx                  ← Root layout, global state, role-aware routing
│   ├── main.jsx
│   ├── components/
│   │   ├── Sidebar.jsx          ← Dynamic navigation (Users (Orca), Recruiting Pipeline, etc.)
│   │   ├── TopBar.jsx           ← Search + Ask Claude button
│   │   ├── UserDrawer.jsx       ← Slide-in user detail panel (7-step CX checklist)
│   │   ├── AiAssistant.jsx      ← Floating Claude chat
│   │   ├── UserTable.jsx        ← Reusable user table
│   │   ├── EmptyState.jsx       ← Clean placeholder UI when no Airtable data exists
│   │   └── ui.jsx               ← Card, PageHeader, StatCard, StatusPill, Note
│   ├── modules/
│   │   ├── Dashboard.jsx        ← Live stats, trend charts, active users
│   │   ├── Users.jsx            ← Users (Orca) list, management, export CSV
│   │   ├── OnboardingFlow.jsx   ← Onboarding Flow (Orca) 7-step simulation & live queue
│   │   ├── AutomationPanel.jsx  ← AI Automation (Orca) activity log, welcome email previewer
│   │   ├── FranchiseResearch.jsx← Merchant Market Research: Claude-powered city scoring
│   │   ├── LeadGeneration.jsx   ← Merchant Lead Generation: Search Google/Yelp, score, assign
│   │   ├── RecruiterPortal.jsx  ← Recruiting Pipeline funnel & recruits CRUD (NEW)
│   │   ├── AgentPortal.jsx      ← Standalone mobile-first agent/reseller lead dialer portal
│   │   ├── QualifierPortal.jsx  ← Qualifier queue (Mildred's lead qualification inbox)
│   │   ├── DataIntegration.jsx  ← CSV import/export + API sync
│   │   ├── Settings.jsx         ← Health check, open items, team, env vars
│   │   ├── Login.jsx            ← Auth login with forgot password
│   │   └── ChangePassword.jsx   ← First-login password change
│   ├── data/
│   │   ├── constants.js         ← USER_TYPES, ONBOARDING_STAGES, TEAM, AGENTS, etc.
│   │   ├── seed.js              ← Demo fallback assets
│   │   └── roles.js             ← Role definitions, view permissions, default paths
│   ├── lib/
│   │   ├── claudeClient.js      ← askClaude() → proxy
│   │   ├── dataLayer.js         ← API client functions + localStorage persistence
│   │   ├── csvParser.js         ← parseCSV() + CSV_TEMPLATE
│   │   └── status.js            ← computeStatus(), formatNumber(), formatToday()
│   └── styles/global.css
├── index.html
├── package.json
└── README.md
```

---

## 3. Airtable Tables

Create **5 tables** in your Airtable base before transitioning from CSV to API mode:

### 1. Users
| Field | Type | Notes |
|-------|------|-------|
| ID | Single line text | e.g. WC-1001 |
| Name | Single line text | |
| Type | Single select | Options: COLD_CALLER, REP, RESELLER, ISO, REFERRAL |
| Stage | Number | 1–7 |
| LeadsThisWeek | Number | |
| DealsThisMonth | Number | |
| Joined | Date | |
| Market | Single line text | e.g. "Dallas, TX" |
| Email | Email | |
| Notes | Long text | |

### 2. Staff
| Field | Type | Notes |
|-------|------|-------|
| Email | Email | Login email |
| Name | Single line text | |
| Role | Single select | pm, admin, cx, recruiter, marketer, trainer, cold_caller, independent_rep, authorized_reseller, iso_investor, referral_partner, agent_supervisor |
| PasswordHash | Single line text | PBKDF2 hash (created by seed script) |
| MustChangePassword | Checkbox | Force password change on first login |

### 3. Leads
| Field | Type | Notes |
|-------|------|-------|
| PlaceID | Single line text | Google Place ID or yelp-{id} (Unique) |
| BusinessName | Single line text | |
| Type | Single line text | restaurant, beauty_salon, nail_salon, deli, massage, small_retail |
| Address | Single line text | |
| Phone | Single line text | |
| Website | URL | |
| Rating | Number | |
| ReviewCount | Number | |
| Score | Number | 0–100 (Claude-scored) |
| ScoreReason | Single line text | |
| Status | Single select | New, Assigned, Called, Interested, NotInterested, Callback, NoAnswer |
| AssignedAgent | Single line text | |
| CalledAt | Date & time | |
| Outcome | Single line text | |
| Market | Single line text | |
| CreatedAt | Date & time | |
| GeneratedBy | Single line text | Tracking source agent or batch manager |

### 4. RecruitingPipeline
| Field | Type | Notes |
|-------|------|-------|
| Name | Single line text | Recruit's name |
| Email | Email | |
| Phone | Single line text | |
| Source | Single select | LinkedIn, Referral, Job Board, Social Media, Direct Outreach, Other |
| Type | Single select | Independent Rep, ISO Investor, Referral Partner |
| Status | Single select | New, Contacted, Interested, Onboarding, Active, Declined |
| Notes | Long text | |
| AddedBy | Single line text | Recruiter who added them |
| AddedAt | Date & time | |
| LastContactedAt | Date & time | |
| OnboardingStage | Number | 1-7 |

### 5. AutomationLog
| Field | Type | Notes |
|-------|------|-------|
| Task | Single line text | |
| Target | Single line text | |
| Status | Single select | sent, ok, alert, error |
| Timestamp | Date & time | |

---

## 4. Environment Variables

| Variable | Required | Description | Where to get |
|----------|----------|-------------|-------------|
| `VITE_CLAUDE_PROXY_URL` | Frontend | Express proxy URL | `http://localhost:3001/api/claude` locally |
| `ANTHROPIC_API_KEY` | Server | Claude AI API key | console.anthropic.com |
| `AIRTABLE_API_KEY` | Server | Airtable personal access token | airtable.com/create/tokens |
| `AIRTABLE_BASE_ID` | Server | Airtable base ID (starts with `app`) | Open base → Help → API docs |
| `RESEND_API_KEY` | Server | Resend email API key | resend.com |
| `EMAIL_FROM` | Server | Verified sender email | Must match Resend domain |
| `RIYASH_EMAIL` | Server | PM email reports recipient | riyash@waveclosers.com |
| `WILLIAM_EMAIL` | Server | Admin email reports recipient | william@waveclosers.com |
| `RECRUITER_EMAIL` | Server | Recruiter portal account email | aureliab@waveclosers.com |
| `GOOGLE_PLACES_API_KEY` | Server | Google Places API key (Primary source) | console.cloud.google.com |
| `YELP_API_KEY` | Server | Yelp Fusion API key (Backup source) | fusion.yelp.com |
| `DAILY_LEADS_PER_AGENT` | Server | Target leads/agent/day (default: 100) | Adjust as needed |
| `NUM_AGENTS` | Server | Number of cold-calling agents (default: 9) | Update when team changes |
| `PORT` | Server | Express port (default: 3001) | Set in Railway |

---

## 5. The 14 Open Items (Scope §12)

1. **API availability from waveclosers.com** — blocks API sync mode.
2. **Weekly lead targets per user type** — blocks lead-shortfall alerts.
3. **Monthly quota benchmarks per user type** — blocks quota-miss escalations.
4. **Contract template for CX automation** — blocks contract dispatch email.
5. **Online learning platform link / login flow** — blocks Step 3 of CX onboarding.
6. **Thursday sales training meeting time** — blocks Step 4 of CX onboarding.
7. **Sales Manager role assignment** — blocks Step 6 ownership.
8. **Google Places API key** — blocks primary lead source (using Yelp only until confirmed).
9. **Yelp API key** — blocks backup lead source.
10. **Target markets / cities for first lead batch** — blocks weekly lead generation.
11. **Aureliab exact email address** — blocks recruiter account creation.
12. **MeetGold platform transfer** — blocks Step 6 of CX onboarding.
13. **Brain Goats details and link** — blocks Step 5 of CX onboarding.
14. **Lead Gen Service details and link** — blocks Step 7 of CX onboarding.

Every pending item is a configuration change, not a code change. Swapping values takes less than 5 minutes.
