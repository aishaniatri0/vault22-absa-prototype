# Round-2 Completion & Verification Prompt — ABSA prototype

Target: `~/Downloads/Vault22-Absa-Prototype`. Shell = `index.html`; sections in `sections/*.html`.
Commit `06396d2` ("UI consistency + navigation + Explore Portfolios fixes") **claimed** these items were
done, but driving the deployed build shows four are **not actually implemented** or are stubs. This
prompt is scoped to finishing them **properly and verifiably**. Do everything within the ABSA guidelines
(Absa maroon `#95052A` / `#77021E`, ZAR `R`, Inter, existing shell). **Verify every item by driving the
UI in a browser** — a claim in the commit message is not acceptance.

## Ground rules
- Cache-bust is automatic (`index.html` `BUILD = Date.now()`); no version bump needed.
- Do not regress: CASA-only invest terminus, model portfolios out of the Trade universe, ZAR Home.
- Secrets stay un-committed: `qa/sa-portfolio-capture/` (session tokens) and
  `SA-PORTFOLIO-DETAILS-FIX-PROMPT.md` (credentials) are git-ignored — never push them.

---

## 1. "I'm not sure, help me" must run the risk-assessment questionnaire (currently a stub)

**How it is now.** On the "What is your investment style?" screen, the primary path works (six styles,
Absa-skinned), but **"I'm not sure, help me"** is a stub: `onclick="selectStyle('Balanced')"`
(`sections/model-portfolio.html:441`) — it silently picks Balanced and skips the assessment entirely.
Meanwhile a **complete, live-sourced risk questionnaire already exists** in the goals bundle but is not
wired into this flow:
- `window.RA_RISK_QS` — 3 questions × 5 options, scored 0-4, "sourced VERBATIM from the live SA app"
  (`sections/goals.html:46910-46932`).
- `window.scoreRiskProfile()` / `window.styleForBand()` — maps answers to one of the six styles
  (`goals.html:46933-46945`).
- `window.RiskAssessmentScreen` — the questions → complete → result flow (`goals.html:46975+`).

**How it should work.** In the live app, "I'm not sure, help me" leads into the **risk-assessment
questions**, not a default pick. Wire "I'm not sure, help me" to launch that questionnaire (reuse the
existing `RA_RISK_QS` / `scoreRiskProfile` / `RiskAssessmentScreen` logic; do not invent a second set),
render it Absa-skinned and ZAR, and on completion land the user on the **matched style → matched
portfolios in Explore Portfolios**. Never auto-select Balanced.
- Log in with `qa/sa-portfolio-capture/login.py` and walk the live flow (Investments → Start here →
  "I'm not sure, help me") to match question wording, order, and the result screen.

**Accept:** Click "I'm not sure, help me" → the 3-question assessment appears → answering it produces a
matched style and shows matched portfolios. It never jumps straight to a preset style.

## 2. Back navigation must follow the journey INSIDE the Investments/portfolio path (partially broken)

**How it is now.** A shell nav stack exists (`navStack`/`pushNav`/`goBack`/`#backBtn`,
`index.html:760-792`) and the **top-level** case works — verified: Home → Budget → Back returns to Home.
**But the intra-journey case fails**: Home → Investments → Explore Portfolios tab → select a portfolio →
(fact sheet / risk flow) → **Back jumps straight to Home**, skipping the portfolio detail and the
Investments landing. Cause: navigation *within* the Investments page (tab switches, portfolio selection,
fact-sheet/risk overlays in `model-portfolio.html` and the goals landing) is **not recorded**, and the
embedded apps do not implement the `__absaBack` hook the shell calls first
(`index.html:778-783`), so Back has nothing to step back through and pops the shell straight to Home.

**How it should work.** Back must follow the **actual journey** at every depth:
- Implement `window.__absaBack` in `sections/model-portfolio.html` (and the goals Investments landing)
  so it consumes Back **one step at a time**: close fact sheet → close risk flow/quiz → close invest
  drawer → deselect portfolio → leave Explore tab → then the shell pops to the previous page.
  It must return `true` when it handled the step (so the shell does not also pop).
- Confirm the two required behaviours: a page opened **from Home** returns to **Home**; a page/detail
  opened **from another page** returns to the **page it came from**, stepping back through each screen
  the user actually visited.

**Accept:** Home → Investments → open a portfolio → open its fact sheet → Back returns to the portfolio
detail (not Home) → Back returns to Explore/Investments → Back returns to Home. And Home → Budget → Back
still returns to Home. Every Back matches the real path.

## 3. UI consistency across the WHOLE prototype (only a partial hover pass was done)

**How it is now.** Commit `06396d2` added a `.home-card` hover to the Home cards only. The
prototype-wide standardisation item was **not** done: `goals.html` (React), `live.html`, `reports.html`,
`budget.html`, `model-portfolio.html`, `investments.html`, `leaderboard/`, `marketplace.html` still use
visibly different spacing, type scales, card radius/shadow, buttons and interactions. It still reads as
several prototypes stitched together.

**How it should work.**
- Establish **one design language** and apply it across **every** page: spacing scale, typography, card
  radius/shadow/border, button styles, colour usage, hover/press. Not just Home.
- **Primary reference: the Leaderboard (`sections/leaderboard/`) and Budget (`sections/budget.html`)
  prototypes** (strongest visual quality); take cues from the live Vault22 app; keep everything **Absa**
  (maroon, ZAR). Extend the shared token files (`DESIGN-TOKENS.css`, `live-app-tokens.css`) and have the
  sections consume them rather than ad-hoc per-file values.
- Content and navigation rules must not change — this is a visual-consistency pass.

**Accept:** Move Home → Budget → Investments → Explore Portfolios → MMF → Leaderboard → Marketplace: the
cards, buttons, type and spacing read as one product. Name specific before/after changes per section;
"added a hover" is not sufficient.

## 4. Home must read as a true dashboard (only light polish was done)

**How it is now.** `HomeScreen` (`goals.html:43506`) got a time-aware greeting and section labels in the
last commit, but it still feels sparse and not dashboard-like.

**How it should work.**
- **Without changing architecture or the navigation rules (items 1-2)**, make Home genuinely
  dashboard-like: stronger header/greeting, a fuller and better-balanced grid, and appropriate
  supporting data so each card feels complete (net worth trend, budget pacing, goals progress, recent
  activity/insights, quick actions). Keep all existing content; enhance, do not remove.
- Inspiration from the live Vault22 home, but stay in the Absa design language from item 3. Do not copy
  wholesale.

**Accept:** Home reads as a polished, informative dashboard with no empty feel; every existing card and
all navigation rules still work; figures stay ZAR with no `$`.

---

## Definition of done (all driven in-browser, zero console errors)
1. "I'm not sure, help me" runs the 3-question assessment → matched style → matched portfolios; never
   auto-picks Balanced.
2. Back follows the real journey at every depth (fact sheet → detail → Explore → Investments → Home),
   and Home-origin pages still return to Home.
3. One consistent design language across ALL sections (Leaderboard/Budget as reference), with the
   specific changes listed per section.
4. Home reads as a true dashboard; content preserved; ZAR only.
5. No regression to CASA invest, Trade-universe removal, or the portfolio journey.
6. Report acceptance with what was actually driven in the browser, not commit-message claims.
