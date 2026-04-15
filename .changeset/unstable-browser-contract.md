---
"effect": minor
"@effect/platform-node": minor
---

Tighten `effect/unstable/browser` resource and error contracts, add `BrowserDriver.transform` / `tapLaunch`, `Browser.withPage` / `withPageFromLaunch`, and `Pipeable` session/page surfaces. Extend `BrowserPage` with read/navigation/observability operations (`text`, `innerText`, `getAttribute`, `evaluate`, `screenshot`, `reload`, `goBack`, `waitForURL`, `waitForLoadState`), broaden `BrowserNavigationError`, and add `BrowserWorkflow` for sequencing and clock-aware retries. Align the Playwright Node adapter with the new types and errors.

Add `BrowserEvaluateError` for in-page `evaluate` failures (parse vs runtime), `BrowserWorkflow.evaluateDecode` (decode `evaluate` results with `Schema`), `forEachMatch`, `tapOptional`, and `titleIncludes`. Extend `BrowserPage` with multi-match and interaction helpers: `locatorCount`, `allTextContents`, `clickNth`, `hover`, `press`, and `scrollIntoViewIfNeeded`. The Node Playwright driver classifies evaluate errors and implements the new operations.
