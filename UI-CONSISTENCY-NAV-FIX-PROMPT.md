# UI Consistency + Navigation + Explore Portfolios Fix Prompt — ABSA prototype

Target: `~/Downloads/Vault22-Absa-Prototype`. Shell = `index.html` (iframe host); feature screens in
`sections/*.html`. Everything below must be implemented **within the ABSA guidelines and the way ABSA
works** — Absa maroon `#95052A` (dark `#77021E`, red accent), ZAR (`R`, en-US grouping), Inter, the
existing rounded-card / left-sidebar shell. Each item is **How it is now -> How it should work** with
the code traced. Verify by driving the UI in a browser, not by grepping.

## Ground rules
- Do not regress the verified prior work: portfolio journey ends in the CASA payment step (CASA is the
  only funding), model portfolios stay out of the Trade universe, Home is ZAR (no `$`).
- Do not touch the deferred modules' behaviour except for the shared UI-standardisation pass (item 7):
  Leaderboard, Marketplace, Financial Fitness, Family Circle keep their content.
- Cache-bust is automatic (`index.html` uses `BUILD = Date.now()`), so no version bump is needed.
- Secrets: `qa/sa-portfolio-capture/` (session tokens) and `SA-PORTFOLIO-DETAILS-FIX-PROMPT.md`
  (credentials) are git-ignored. Never commit them. Reference the SA captures locally only.

---

## 1. Budget card on Home navigates to the Budget page

**How it is now.** On Home, `BudgetCard` (`sections/goals.html:43859`) renders but has **no click
handler** — unlike `GoalsCard` (`:43905`) which takes an `onGoals` callback that drives the shell. The
shell exposes `window.go(key)` (`index.html:722`) and Home cards reach it via `window.parent.go(...)`.

**How it should work.**
- Make the Budget card (the whole card, or a clear "View budget" affordance on it) navigate straight to
  the **Budget** page: pass an `onBudget` prop into `HomeScreen`/`BudgetCard` that calls
  `window.parent.go('budget')` (mirror how `onGoals` is wired at `goals.html:43533`, `43914`).
- Use the standard card hover/press affordance (item 3) so it reads as clickable.

**Accept:** Click the Budget card on Home and the Budget page opens (sidebar "Budget" active).

## 2. Journey-aware Back navigation

**How it is now.** The shell's `activate(key)` (`index.html:642`) just swaps the active iframe — there
is **no navigation history**. The breadcrumb `crHome` is a static "Home" (`index.html:248`), and
`injectGoalsBack()` (`:540`) only adds an *intra-app* "‹ Back" that clicks the embedded app's own
parent breadcrumb. So there is no concept of "return to the page I came from".

**How it should work.** Add a **shell-level navigation stack** so Back follows the user's real journey:
- Maintain a history stack in the shell as the user navigates between top-level pages (push on each
  `activate`/`go`, ignoring same-page re-entry).
- A page opened **from Home** -> Back returns to **Home**.
- A page opened **from another page** (e.g. Home -> Investments -> a detail) -> Back returns to the
  **previous page** (Investments), not Home.
- Surface Back consistently (a shell top-bar Back control and/or the existing per-app back), and keep
  the breadcrumb in step with the stack. Do not break the Investments sub-nav or the embedded apps' own
  internal back buttons.

**Accept:** Home -> Budget -> Back lands on Home. Home -> Investments -> open a portfolio -> Back lands
on Investments, and Back again lands on Home. The path always mirrors how you actually arrived.

## 3. Consistent Home-card hover / interaction

**How it is now.** The **User Report** cards have a well-implemented hover; other Home cards
(`WalletCard`, `BudgetCard`, `GoalsCard`, `NetWorthCard`, Profile, Financial Fitness, Insights in
`HomeScreen` `goals.html:43506+`) have inconsistent or missing hover/press states.

**How it should work.**
- Adopt the User Report card's hover/interaction as the **single standard** for every Home card:
  consistent elevation/border/cursor on hover, a subtle press state, and a clear affordance when the
  card is clickable (Budget -> Budget page, Goals -> Goals, Wallet -> wallet, etc.).
- Same transition timing and easing across all cards.

**Accept:** Every Home card has the same hover and press behaviour; none feels dead or styled
differently from the User Report cards.

## 4. Explore Portfolios is not a separate page — only reached from Investments

**How it is now.** A prior round added `modelport` as a **standalone left-sidebar sub-item**
("Explore Portfolios") under Investments (`index.html:676`, `INV_TABS`) that swaps in
`sections/model-portfolio.html` as its own destination. The Investments landing *also* has an
"Explore Portfolios" tab that hands off to it (`goals.html:51421`, `window.parent.openModelPortfolios`).
This makes Explore Portfolios feel like a separate page.

**How it should work** (this **supersedes** the sub-nav approach in `PORTFOLIO-FLOW-FIX-PROMPT.md`).
- **Remove the standalone `modelport` left-nav sub-item.** Explore Portfolios must be reachable **only
  from the Investments page**, as a **tab within the My Investments landing** — exactly the live journey:
  `My Investments | Explore Portfolios` tabs at the top of the Investments page (see the SA capture
  `qa/sa-portfolio-capture/11-after-explore.png`).
- Selecting a portfolio still opens the details + the CASA invest journey (unchanged from the prior
  round). Keep `openModelPortfolios`/`fr-modelport` only if it is used *inside* the Investments page
  flow, not as its own sidebar entry.
- The Investments left sub-nav should mirror the live app's set (Portfolio / Market Forecast /
  Leaderboard), not a separate "Explore Portfolios" entry.

**Accept:** There is no "Explore Portfolios" item in the sidebar. Explore Portfolios appears only as a
tab on the Investments page, and selecting a portfolio there runs the select -> amount -> CASA -> submit
journey.

## 5. Fact Sheet works like the live app

**How it is now.** The fact sheet is a stub: `onclick="toast('Fact sheet downloaded')"`
(`sections/model-portfolio.html:263`).

**How it should work.**
- Make the Fact Sheet behave like the live app:
  **https://absa-uganda-investment.dev.vault22.com/portfolios/default-absa-ug-aggressive-001?view=1**
  (reachable; open it and replicate). Rather than a toast, open the fact-sheet view (the portfolio
  fact-sheet page/panel with monthly performance & portfolio breakdown), Absa-skinned and ZAR.
- Keep it within the prototype's shell (inline panel or in-app view), not a dead download.

**Accept:** Open a portfolio -> Fact sheet -> the fact-sheet content renders as in the live portfolio
view, not a toast.

## 6. Risk-profile flow follows the live Vault22 app

**How it is now.** The "Let us help you choose the right investments for your goals / Set your risk
profile..." banner's **Start here** is a stub: `toast('Risk profiling - coming soon')`
(`sections/model-portfolio.html:138`); the Investments landing banner's "Do it now" behaves similarly.

**How it should work.**
- Build the risk-profile journey to match the **current live Vault22 flow** as closely as possible:
  the **"New Investment Goal -> What is your investment style?"** step with the six styles
  (Ultra-Low / Conservative / Cautious / Balanced / Growth / Aggressive), then onward to matched
  portfolios. Reference the captured live screens `qa/sa-portfolio-capture/21-invest-drawer.png` and
  `32-flow-step2.png` (log in with `qa/sa-portfolio-capture/login.py` to walk the full flow).
- Absa-skin it (maroon, ZAR) and land the user on the matched portfolios in Explore Portfolios.
- Note: the **Invest** action on a chosen portfolio still terminates in the CASA payment journey per
  Uday — the risk-profile flow is for *matching/discovery*, it does not replace the CASA invest step.

**Accept:** Start here / Do it now opens the live-style risk-profile flow (investment style -> matched
portfolios), Absa-skinned, and investing from a matched portfolio still uses the CASA journey.

## 7. Standardise the UI across the whole prototype

**How it is now.** The prototype merges several sources — `goals.html` (React), `live.html`,
`reports.html`, `budget.html`, `model-portfolio.html`, `investments.html`, `leaderboard/`,
`marketplace.html` — with visibly different spacing, type scales, card and button styling. It reads as
stitched-together.

**How it should work.**
- Establish **one design language** and apply it across every page: spacing scale, typography, card
  radius/shadow/border, button styles, colour usage, and hover/press interactions.
- **Primary reference: the Leaderboard (`sections/leaderboard/`) and Budget (`sections/budget.html`)
  prototypes** — they have the strongest visual quality. Take inspiration from the current live Vault22
  app where appropriate. Reuse the existing token files (`DESIGN-TOKENS.css`, `live-app-tokens.css`)
  and extend them into a shared set the sections import, rather than per-file ad-hoc values.
- Everything stays **Absa** (maroon, not Vault22 green) and ZAR. Do not change any page's *content* or
  navigation rules — this is a visual-consistency pass only.

**Accept:** Moving between Home, Budget, Investments, Explore Portfolios, MMF, Leaderboard, etc., the
cards, buttons, type and spacing feel like one product. No page looks like it came from a different app.

## 8. Make Home feel like a true dashboard

**How it is now.** Home (`HomeScreen` `goals.html:43506`) is populated (Net worth, Wallet, Profile,
Financial Fitness, Budget, Goals, Insights) but still reads sparse and not fully dashboard-like.

**How it should work.**
- **Without changing the app architecture or the navigation rules (items 1-2)**, make Home more
  welcoming and informative: a warmer greeting/header, better layout and density, and appropriate data
  so each card feels complete.
- **Keep the existing content** — enhance it (add relevant supporting figures, a cleaner grid, section
  headers), do not remove cards. Take inspiration from the live Vault22 home but do **not** copy it
  wholesale; stay within the Absa design language from item 7.

**Accept:** Home reads as a polished, complete dashboard — welcoming header, consistent cards, no empty
feel — while every existing card and the navigation rules still work.

---

## Definition of done
1. Each item satisfies its Accept line, driven in the browser, zero console errors.
2. Explore Portfolios is a tab on the Investments page only — no sidebar entry; portfolio -> CASA
   journey intact.
3. Back navigation follows the real journey (Home-origin returns Home; page-origin returns to that page).
4. Fact sheet and risk-profile flow match the referenced live app, Absa-skinned and ZAR.
5. One consistent design language across all pages (Leaderboard/Budget as reference); Home reads as a
   true dashboard.
6. No regression to the CASA invest journey, the Trade-universe removal, or the ZAR Home figures.
7. Secrets remain un-committed; only code and (optionally) prompt docs without credentials are pushed.
