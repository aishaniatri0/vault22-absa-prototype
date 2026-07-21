# Home-Dashboard Fix Prompt — ABSA prototype (post-review follow-ups)

Target: `~/Downloads/Vault22-Absa-Prototype`. Shell = `index.html`; Home is served by
`sections/goals.html` (`home` route, `index.html:316`). These are the findings from reviewing the
PORTFOLIO-FLOW-FIX-PROMPT.md work in the browser: the portfolio flow, CASA selector and Budget card
all verified good; the items below are what remains. Each is **How it is now -> How it should work**
with the code traced.

## Ground rules
- Do not regress the verified fixes: Explore Portfolios -> model-portfolio.html journey, CASA-only
  funding selector, model portfolios removed from the Trade universe, and the populated Budget card.
- Do not touch Leaderboard, Marketplace, Financial Fitness, Family Circle, or the deferred modules
  (Debt / Tara / To-do / Insights).
- Absa is a **ZAR** experience. Rands, formatted `R51,971` (en-US grouping, `R` prefix, no cents on
  whole amounts). No em dashes in rendered copy.
- Verify by driving the Home screen in a browser, not by grepping.

---

## 1. Net worth card — empty "$0" Savings tile and wrong currency

**How it is now.** `NetWorthCard` (`goals.html:43649-43692`) renders on Home in **USD** and with an
empty Savings tile:
- `const savings = 0;` (`:43653`) -> the Savings tile shows **`$0`** and a **`↑ $0 (30 days)`** pill
  (`:43676-43678`).
- The whole card is dollar-formatted: net worth `${netWorth...}` (`:43672`), Investments
  `${wallet.value...}` (`:43683`), all via `toLocaleString('en-US')` with a hardcoded `$`.
- Result: on the same Home screen the Budget card now reads ZAR (`R51,971`) while this card reads
  `$50,282 / $0 / $5,282` — a mixed-currency dashboard with a blank Savings tile, which is exactly the
  "looks empty" impression item 6 was meant to remove.

**How it should work.**
- **Populate Savings** with a realistic figure consistent with the rest of the mock (e.g. a cash/savings
  balance in the low tens of thousands of Rand) so the tile is not blank. Give its 30-day pill a
  sensible non-zero delta rather than `↑ $0`.
- **Convert the whole card to ZAR.** Net worth, Savings and Investments all render with the `R` prefix
  using the same formatting as the Budget card. `netWorth = investments + savings + otherAccounts`
  must still reconcile (`:43655`), and `otherAccounts` (`:43654`) stays a plausible Rand figure.
- Keep the card's existing layout, gradient and "30 days" delta pills — only the values, currency
  symbol and the Savings figure change.

**Accept:** Open Home. The Net worth card is in Rands, its Savings tile shows a real value with a
non-zero 30-day change, and net worth = savings + investments + other accounts. No `$` anywhere on the
Home dashboard.

## 2. Sweep the rest of the Home dashboard for USD / empty tiles

**How it is now.** The Net worth card was found by driving the screen; other Home tiles in the same
`goals.html` bundle (a reused multi-region app) may also render `$` or `en-US` dollar formatting, or
sit at a placeholder zero.

**How it should work.**
- Sweep every card rendered on the **Home** route (the Net worth / Wallet / Profile / Financial Fitness
  top row at `goals.html:43500` onward, and the bottom-row cards) and bring any USD `$` formatting to
  ZAR `R`, and any placeholder `$0` / empty state to a realistic populated value.
- Scope is the Home dashboard only. Do **not** re-currency the Trade / brokerage screens or other
  sections — only what the Absa Home route actually shows.

**Accept:** Every value visible on Home is in Rands and populated; there is no `$` and no stray `0`
placeholder tile on the Home screen.

---

## Blocked / needed (unchanged from prior round)
- **Item 5 — SA Portfolio Details** is still open and still blocked. Replicating the live ABSA web
  Portfolio Details page needs an **SA-region login** (only SA users see that experience); the only
  reference on disk is the Uganda MMF app (`qa/ABSA-MMF-REFERENCE.md`). Supply SA-region credentials or
  an export/screenshots of the SA Portfolio Details page, then `renderDetail()` in
  `sections/model-portfolio.html` can be built to match. Until then, do not approximate it.

## Definition of done
1. Net worth card is fully ZAR with a populated, non-zero Savings tile; net worth reconciles.
2. No `$` symbol and no empty `0` placeholder tile anywhere on the Home dashboard, verified in-browser.
3. Budget card, portfolio flow, CASA selector and Trade-universe changes all still pass (no regression).
4. No console errors; approved and deferred modules untouched.
