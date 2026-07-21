# Portfolio-Flow Fix Prompt — ABSA prototype (post-Uday review)

Target: `~/Downloads/Vault22-Absa-Prototype`. Shell = `index.html` (iframe host); feature screens live in
`sections/*.html`. Absa-skinned, mock data. Each item is written **How it is now -> How it should work**
with the code already traced, so it can be worked in one pass.

## Ground rules
- Do not touch Leaderboard, Marketplace, Financial Fitness, Family Circle (approved; no changes).
- Do not build a new investment flow. **Reuse the existing MMF / CASA journey.** Absa maroon `#95052A`,
  dark `#77021E`. Rands via the existing `zar()` helper. No em dashes in rendered copy.
- Verify by driving the UI in a browser, not by grepping for markers.
- `index.html` cache-busts sections with `BUILD = Date.now()` (`index.html:333`), so no manual version bump
  is needed; a hard refresh picks up edited section files.

---

## 1. Explore Portfolios must lead to the investment journey, not a trading screen

**How it is now.** Selecting a portfolio routes the user into a trading experience. The "Explore
Portfolios / Model Portfolios" journey is served two wrong ways:
- The correct destination `sections/model-portfolio.html` exists (`fr-modelport` iframe `index.html:284`,
  `SRC.modelport` `index.html:334`) but is **orphaned** — nothing in the nav routes to it.
- The reachable path is the **Trade / Discover** brokerage inside `sections/goals.html`, where model
  portfolios are defined as tradeable securities (`ABSAC` / `ABSAB` / `ABSAG` / `ABSHAR`,
  `goals.html:36806-36810`, `assetClass: 'Model Portfolio'`) and open a full stock-trading UI with
  Buy/Sell, order type, TIF and working orders (`onTrade(...,'buy'|'sell')`, e.g.
  `goals.html:39851-39852`, `40040`, `40679`).

**How it should work.** The single portfolio journey must be:

> Explore Portfolios -> Select Portfolio -> Enter Investment Amount -> Choose Funding Account (CASA)
> -> Submit Investment Request

- Route "Explore Portfolios / Model Portfolios" to `sections/model-portfolio.html`, which already
  implements exactly this journey (select -> Invest -> amount -> account -> confirm -> submit, no
  Buy/Sell). Wire it in as a real destination: add a `modelport` entry to the Investments sub-nav
  `INV_TABS` (`index.html:674`) — or the appropriate sidebar route — using the existing `fr-modelport`
  iframe and `SRC.modelport`, and drive it the same way the other sub-tabs are driven in `showInvTab()`
  (`index.html:697-713`).
- Selecting a portfolio goes **straight into the invest drawer**. No intermediate Portfolio-Details ->
  Trading detour.

**Accept:** From the sidebar, open Explore Portfolios, pick any portfolio, and you land in the
amount -> account -> submit drawer. There is no way to reach Buy/Sell from a portfolio.

## 2. No trading interface anywhere in the portfolio flow

**How it is now.** Model portfolios appear as line items in the brokerage Discover list and holdings
table, each carrying Buy/Sell controls (`goals.html:39851-39852`, `40040`) and opening the
`TickerDetailScreen` order ticket (`goals.html:40353`, `40679`).

**How it should work.**
- Remove the Model-Portfolio instruments (`ABSAC`, `ABSAB`, `ABSAG`, `ABSHAR`) from the tradeable
  `window.MARKET` universe in `goals.html` (`36806-36810`) so they no longer surface in Discover, the
  holdings table, or the order ticket. Individual stocks/ETFs may remain in Trade as they are — only
  the **model portfolios** must leave the trading path.
- Confirm no Buy button, Sell button, or trading interface renders anywhere within the portfolio
  journey after this change.

**Accept:** Search the Discover/Trade list for "Model Portfolio" — none appear. The only place a model
portfolio can be actioned is the model-portfolio.html invest journey.

## 3. Reuse the ABSA MMF investment flow / CASA payment journey

**How it is now.** `sections/model-portfolio.html` already runs its own invest drawer
(`openInvest()` / `renderDrawer()`, `model-portfolio.html:244-276`) with a hardcoded funding account
`ACCOUNT = {name:'Absa Cheque Account', mask:'9012', balance:48250}` (`model-portfolio.html:179`).
The MMF flow with the canonical account selector lives in `sections/investments.html`.

**How it should work.**
- Keep model-portfolio.html's amount -> confirm -> submit steps, but make the **funding-account step
  mirror the exact CASA account selector used in ABSA MMF** (`sections/investments.html` account picker),
  so the two journeys look and behave the same. Do not invent a second, divergent selector.
- Do not build a parallel flow; connect Model Portfolio -> the existing CASA payment journey.

**Accept:** The portfolio invest drawer's account step is visually and behaviourally the same CASA
selector as the MMF Buy flow.

## 4. Funding account is always the CASA account

**How it is now.** model-portfolio.html funds from `Absa Cheque Account ••••9012` (the CASA account),
which is correct, but it is a single hardcoded value rather than the shared CASA selection.

**How it should work.**
- The funding method must **always** be the CASA account. There is no generic / alternative funding
  method anywhere in the portfolio flow.
- Use the same CASA account object the MMF flow uses so the account name, mask and balance are
  consistent across MMF and Model Portfolio.

**Accept:** In the portfolio invest journey the only fundable source is the CASA account, identical to
the one shown in the MMF Buy flow.

## 5. Reference the existing ABSA web Portfolio Details page (SA region)

**How it is now.** model-portfolio.html's Portfolio Details panel is an approximation
(`renderDetail()`, `model-portfolio.html:215-236`); it was not built from the live ABSA web
Portfolio Details page.

**How it should work.**
- Log in to the existing ABSA web app using an **SA-region account** (only SA users see the proper
  portfolio experience), study the Portfolio Details page and the investment journey, and replicate that
  behaviour and layout in model-portfolio.html.
- **Blocked / needed:** SA-region credentials. The reference we hold
  (`qa/ABSA-MMF-REFERENCE.md`) is the Uganda live app (UGX, zero balance), not the SA portfolio journey.
  If SA login cannot be reached, stop and report rather than approximating — do not guess the SA layout.

**Accept:** The Portfolio Details page and journey match the live SA ABSA web app, reviewed on an
SA-region account.

## 6. Populate the Dashboard Home with realistic data

**How it is now.** Home (`home` route -> `goals.html`, `index.html:316`; `HomeScreen`
`goals.html:43506`, `active === 'home'` `goals.html:51756`) reads empty.

**How it should work.**
- Populate Home with realistic figures — **budget this month, amount spent, monthly budget values** —
  reusing the existing budget prototype data (`sections/budget.html`) so the numbers are consistent
  with the Budget screen. The dashboard must look populated, not blank.

**Accept:** Open Home and it shows real budget-this-month / amount-spent / monthly-budget figures that
match the Budget section, with no empty state.

## 7. No changes to approved modules

Leaderboard, Marketplace, Financial Fitness, Family Circle are already at their approved versions —
**make no changes** to them.

## 8. No work on deferred modules

No immediate work on Debt, Tara, To-do, or Insights. Primary focus stays on the ABSA changes above.

---

## Definition of done
1. Explore Portfolios reaches model-portfolio.html and runs select -> amount -> CASA account -> submit,
   with zero Buy/Sell/trading surface, driven in the browser.
2. Model portfolios are gone from the goals.html trading universe; individual securities unaffected.
3. The portfolio funding step reuses the exact MMF CASA account selector; CASA is the only funding source.
4. Home shows populated budget data matching the Budget section.
5. Leaderboard / Marketplace / Financial Fitness / Family Circle untouched.
6. SA Portfolio Details replication done against an SA-region login, or the SA-login blocker reported.
7. No console errors; no dead nav items (every rendered route resolves).
