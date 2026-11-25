# GrowthHub

GrowthHub is an interview-preparation tracker for students who prepare together. Each student tracks
their own questions and revision progress, and small study groups hold each other accountable by seeing
who is practising, who has hit today's goal, and cheering each other on.

> **Identity:** personal progress tracking + group accountability + interview preparation. Features exist
> to support one of those three things. There is deliberately no task manager and no study planner.

## Quick start

```bash
npm install
cp .env.example .env.local     # then set MONGODB_URI and SESSION_SECRET
npm run dev                    # http://localhost:4000
```

Open the app and click **Try demo** on the login page (a shared demo group with members, questions, mock
rounds and peer ratings is seeded for you), or register with a username and a 6-digit code. Full steps,
environment variables and deployment are further down.

## Status legend

| Label | Meaning |
|-------|---------|
| **Implemented** | Works end to end (UI and API) and is reachable from the app |
| **Partial** | Works with limits, or the backend exists without a complete UI |
| **Planned** | Not built yet |

Only what the code does today is listed. Known gaps are called out so nothing here reads as a promise.

## Features

### Personal progress tracking

| Feature | Status | Notes |
|---------|--------|-------|
| Practice questions (add, edit, delete, search, filter, sort, paginate) | Implemented | Filters by scope, status, track and date range. Statuses: Not Started, In Progress, Done, Revised |
| One-click done | Implemented | A checkbox on every question row; the status menu is still there for In Progress or Revised |
| Questions list | Implemented | Shows **All** questions (newest first); narrow by status, track or a From/To date range in Filters. Group / Personal tabs, with a group filter when you are in more than one group |
| Daily question goal | Implemented | Set in Settings (1-50, default 3). The dashboard ring shows questions solved today against it |
| Study streak | Implemented | Counts any day you practise or solve a question (IST). It drops to 0 after a missed day |
| Overdue questions | Implemented | Merged into **Today's Questions** on the dashboard: overdue items come first with a red "Overdue Nd" tag and highlighted row; solving one removes it |
| Reality Check | Implemented | Dashboard card that auto-rotates a blunt motivational quote every 60 seconds (256 quotes incl. habit books; personalised from your CTC target in Settings) |
| Accent colours | Implemented | Settings > Appearance: Light / Dark / System plus accent colour presets (AA contrast checked) |
| Welcome-back summary | Implemented | After 3+ days away: how many questions are waiting and how many your group solved meanwhile |
| Tracks with a target question count and progress | Implemented | Called **Tracks** in the app. Admins manage shared tracks; anyone manages their personal ones |
| Topics with status and confidence per person | Implemented | Reached from the **Topics** button on the Tracks page. Revision dates are per person |
| Weekly summary | Partial | The Analytics page compares this week with last week; there is no emailed or exportable report |
| Personal notes UI, bookmarks, custom roadmaps | Planned | Notes can be stored by the API but no screen edits them |

### Group accountability

| Feature | Status | Notes |
|---------|--------|-------|
| Create a group, join with a 6-digit invite code | Implemented | Codes last 15 minutes and can be regenerated. Joining is atomic, so the member cap holds under simultaneous joins |
| Roles: Admin, Co-admin, Member | Implemented | Admins promote, demote, remove and transfer the role. The admin must transfer before leaving |
| Several groups per person with an active-group switcher | Implemented | If you leave or are removed from your active group you are moved to another one automatically |
| Member cap | Implemented | 5 members per group |
| Group questions shared with everyone | Implemented | Each member tracks their own status. Admins and co-admins add, edit and delete |
| Leaderboard | Implemented | Ranked by **questions solved** (1 point each); not by speed or day |
| "Done today" for every member | Implemented | Each member card and the dashboard strip show today's count against that person's own goal |
| Weekly group goal | Implemented | Admins set the per-member target in Edit Group (default 5) |
| Interview date and countdown | Implemented | Set in Edit Group; shown on the group page and the dashboard |
| Recent activity feed | Implemented | The latest solves in the group, with who and what |
| Online and last-seen indicators | Implemented | Presence ping every minute while the tab is open |
| Cheers and nudges | Implemented | Cheers from anyone, nudges from admins (to any member), one per type per person per day. Everyone sees a gentle "could use a cheer" hint on quiet teammates; only admins see the detailed reasons |
| Unread badge | Implemented | Unread cheers and nudges show on the Dashboard link |
| Invite code privacy | Implemented | Only admins and co-admins receive the code from the API |
| Member profile (progress, heatmap, mock scores) | Implemented | Limited to groups you share with that person |
| Announcements, shared challenges | Planned | No data model yet |
| Email or push notifications | Planned | The only reminder is an in-browser notification for mock interviews while the page is open |

### Mock interviews

| Feature | Status | Notes |
|---------|--------|-------|
| Group mock date (IST) and add-to-calendar link | Implemented | Admins schedule; past dates are rejected |
| Multiple rounds | Implemented | After a round happens, an admin can **Start next round**; earlier rounds stay in the Past tab. A round whose date has passed and where everyone is Completed is listed under Past straight away (labelled "Round complete" on the Upcoming tab, where Start next round lives) |
| Question generation for each interviewee | Implemented | Rule-based from the person's done questions, weighted by confidence. No AI is used |
| Peer scoring with a four-skill rubric and written feedback | Implemented | Any member except the interviewee, once per session. Rubric, feedback and weak spots are visible to the interviewee and the reviewer who wrote them |
| Weak result queues revision | Implemented | A score under 70 marks the asked topics for revision for the interviewee only |
| Feedback trend for any member | Implemented | Select a member in the roster to see their skill ratings and overall 0-100 score per round |
| Roster with the open member highlighted | Implemented | |
| Next mock on the dashboard | Implemented | |

### Analytics

| Feature | Status | Notes |
|---------|--------|-------|
| Summary cards and status breakdowns | Implemented | |
| This week vs last week, and a 14-day chart | Implemented | |
| Track progress and mock score chart | Implemented | |
| Subject mastery heatmap | Implemented | Confidence-weighted |
| Leaderboard and "solved this week" chart on the group page | Implemented | |
| Monthly reports, date ranges, export of analytics | Planned | |

### Account and settings

| Feature | Status | Notes |
|---------|--------|-------|
| Username and 6-digit login code | Implemented | The code is the password, stored as a salted scrypt hash |
| Recovery key | Implemented | Shown once at sign-up. It lets you set a new login code if you forget it (no longer managed from Settings) |
| Google sign-in | Partial | Depends on the separate CareerFlow backend (see environment variables) |
| Guest demo | Implemented | One **shared** account: every visitor sees and changes the same data, and can only change view preferences on the profile. Disabled in production unless `ALLOW_GUEST_AUTH=true` |
| Onboarding (5 steps) | Implemented | Subjects typed when joining a group are kept as personal tracks |
| Profile editing | Implemented | Name, email, level, target company and role, daily goal, theme, study time, target CTC |
| Download my data | Implemented | A JSON export of your profile, groups, questions and progress, mock results and notes |
| Delete my account | Implemented | Confirmed by typing your username. Blocked while you own a group that still has other members |
| Notification preferences | Planned | |

### Quality, accessibility and offline

| Feature | Status | Notes |
|---------|--------|-------|
| Custom form controls everywhere | Implemented | Dropdown, date picker, slider and dialogs are shared components; no native selects, date inputs or browser confirm boxes |
| Keyboard and screen reader support | Implemented | Dialog focus trap and restore, skip link, `aria-current` on navigation, labelled form fields, sortable-table semantics, reduced-motion support |
| Colour contrast | Implemented | Text colours were adjusted to reach WCAG AA, which made the brand colour slightly darker (`#A84D1F`) |
| Per-page browser titles | Implemented | |
| Local read cache and offline write queue (Dexie) | Implemented | Main screens paint cached data first. Offline edits to questions, tracks, topics and group notes replay in order; the server ignores repeated requests |
| Service worker (production only) | Implemented | Caches pages with their scripts, plus icons, images and fonts. `/api` is never cached |
| Background warm-up | Implemented | Shortly after sign-in the dashboard, questions (default lists), tracks, topics, analytics and each group's pages are fetched in parallel |
| Hover / touch prefetch | Implemented | Hovering, focusing or touching a nav link starts that screen's data requests before you open it |
| Automatic refresh | Implemented | Open screens refresh quietly after any change you make, when you return to the tab, when the connection returns, and every 30 seconds while visible (that is how other members' changes arrive). No manual reload needed |
| Splash screen and loaders | Implemented | Branded splash until your account loads, a top progress bar on navigation, per-page skeletons and a route-level loading skeleton |
| Installable app (web manifest, icons) | Planned | |

Offline mode is best-effort: admin group actions (edit group, members, invite codes, scheduling) always need
a connection, and a first visit with no network cannot load.

## Security notes

- Login attempts are limited per username and per client address, counting **failed** attempts only, and
  the client address is taken from a trusted proxy header. Limits are on in production and off in development.
- The shared demo accounts have no usable login code; they can only be entered with **Try demo**.
- Invite-code guesses, code regeneration and recovery-key attempts are rate limited.
- Group data routes check membership; a person's profile only shows a group you both belong to.
- Server errors return a generic message in production; details are logged on the server.
- Known gaps: there is no Content-Security-Policy header, and the single-sign-on hand-off to CareerFlow puts a
  session token in a URL (it is not single use).

## Technology stack

| Area | Tools |
|------|-------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | MongoDB with Mongoose |
| Styling | Tailwind CSS 3, `clsx`, `lucide-react` icons, Plus Jakarta Sans |
| Charts | d3 and SVG |
| Client storage | Dexie (IndexedDB) for the offline cache and write queue |
| Notifications | `react-hot-toast` |
| Tooling | ESLint, `tsx` |

## Project structure

```
src/
  app/                 Pages and API routes (App Router)
    api/               REST routes: auth, users, groups, questions, subjects, topics,
                       mock-interviews, analytics, dashboard, group-dynamics, group-notes, presence ...
    dashboard/ questions/ subjects/ topics/ groups/ analytics/
    settings/ onboarding/ login/ users/[id]/
  components/
    ui/                Shared design-system components (Select, DatePicker, Slider, Modal ...)
    layout/            App shell, sidebar, mobile nav, group switcher, keyboard shortcuts
    dashboard/ groups/ questions/ analytics/ providers/
  lib/                 Pure logic and helpers (scoring, streaks, momentum, API client,
                       offline cache and warm-up, auth, sessions, rate limiting, recovery keys)
  models/              Mongoose models
  proxy.ts             Auth gate and per-user API rate limit
public/sw.js           Service worker (registered in production only)
```

## Installation

Requirements: Node.js 20 or newer and a MongoDB database (local or Atlas).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file and fill in the two required values (`MONGODB_URI`, `SESSION_SECRET`):

   ```bash
   cp .env.example .env.local
   ```

   Generate a secret with `openssl rand -hex 32` (or any long random string). `.env.example` documents every
   variable, including the optional ones.

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:4000>. Use **Try demo** for the shared demo, or register with a username and a
   6-digit code (and save the recovery key you are shown).

The demo data is seeded the first time someone uses **Try demo**. It is one shared account, so everyone using
the same database sees the same data.

## Environment variables

Set these in `.env.local` (never commit real values); `.env.example` lists all of them with comments. In production, set the same names in the host's environment settings.

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Yes in production | Signs session cookies. Use a long random value. It must match CareerFlow's secret if both apps share one login |
| `ALLOW_GUEST_AUTH` | Production only | Set to `true` to allow the shared guest demo in production (always on in development) |
| `GROWTHHUB_URL` | No | This app's public URL (default `http://localhost:4000`) |
| `CAREERFLOW_URL`, `CAREERFLOW_API_URL`, `NEXT_PUBLIC_CAREERFLOW_URL` | No | CareerFlow app and API, for Google sign-in and the sidebar link (defaults `localhost:3000` and `localhost:8000`). Leave unset if you do not run CareerFlow |
| `COOKIE_DOMAIN` | No | Share the session cookie across subdomains in production |
| `RATE_LIMIT_ENABLED`, `AUTH_RATE_LIMIT_ENABLED` | No | Login rate limiting; on in production, off in development. Set `true` / `false` to override |
| `JOB_TRACKER_URL`, `JOB_TRACKER_API_URL`, `NEXT_PUBLIC_JOB_TRACKER_URL`, `SWITCH_PREP_URL`, `NEXT_PUBLIC_APP_URL` | No | Older names, still read as fallbacks for the URLs above |

## Local development

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server on port 4000. The service worker is disabled and any old one is removed (data warm-up and automatic refresh still run) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |

To try offline behaviour, use a production build (`npm run build && npm start`), sign in, browse a few
pages, then switch the browser to offline in DevTools.

## Deployment

The live app is hosted on Vercel.

1. Create a MongoDB Atlas cluster and allow the host's IP addresses under **Network Access**.
2. Set `MONGODB_URI` and `SESSION_SECRET` in the host's environment settings, plus any optional variables
   above. Set `ALLOW_GUEST_AUTH=true` only if you want the shared demo.
3. Build with `npm run build` and run with `npm start` (Vercel does this automatically).

Rate limits and the short-lived server cache are in memory per instance. On multi-instance or serverless
hosting they are not shared, so treat them as best-effort protection.

## Notes for existing databases

- The Tasks feature was removed. Old `preptasks`, `preparationplans` and `studysessions` collections are no
  longer read and can be dropped. Questions that had the retired "Add to do" status read as Not Started.
- Demo accounts seeded before this version may still hold the old fixed login code. The login route now
  refuses them, but re-seeding the demo (or clearing their `authCodeHash`) removes the stored value.
