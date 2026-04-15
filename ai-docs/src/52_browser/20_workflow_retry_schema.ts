/**
 * @title Browser pages: locators, retry policies, and Schema
 *
 * Use `Browser.withPage` to scope browser startup and teardown, locators to
 * express DOM interactions, and `BrowserError.isRetryableDomError` with
 * `Effect.retry` when you need to tolerate transient page readiness issues.
 * Prefer `BrowserPage.evaluateSchema` when you can decode structured data from
 * the page context instead of scraping full HTML strings.
 */
import * as NodePlaywrightBrowser from "@effect/platform-node/NodePlaywrightBrowser"
import { Effect, Schema } from "effect"
import * as Browser from "effect/unstable/browser/Browser"
import * as BrowserError from "effect/unstable/browser/BrowserError"
import * as BrowserPage from "effect/unstable/browser/BrowserPage"

/** Shape returned from a small `evaluate` script (e.g. reading `window.__DATA__`). */
const PagePayload = Schema.Struct({
  headline: Schema.String,
  count: Schema.Number
})

/**
 * Example program: open a page, wait for the UI with locator-based reads, then
 * decode JSON-like data from the page context.
 *
 * In real tests you would hit your app URL; here the flow shows how the pieces
 * compose. Install `playwright`, run `npx playwright install`, and provide
 * `NodePlaywrightBrowser.layer` when you execute this program.
 *
 * When you add retry policies around locator reads, keep them targeted to the
 * transient DOM errors you actually expect. `BrowserError.isRetryableDomError`
 * is a good default for "the page is still settling" failures.
 */
export const program = Effect.gen(function*() {
  const headline = yield* Browser.withPage({ headless: true }, (page) =>
    Effect.gen(function*() {
      // Navigate first, then wait for the document lifecycle state that your
      // app actually needs before touching the DOM.
      yield* page.goto("https://example.com/")
      yield* page.waitForLoadState("domcontentloaded")

      const heading = page.locator("h1")

      // Locator reads compose naturally with Effect retry policies. Restrict the
      // retry condition to transient DOM failures so genuine browser/navigation
      // errors still fail fast.
      const visibleHeading = yield* heading.innerText().pipe(
        Effect.retry({ while: BrowserError.isRetryableDomError })
      )

      // Prefer `evaluateSchema` when the page can return a structured payload.
      // The browser-side script stays small and the Schema handles validation.
      const payload = yield* BrowserPage.evaluateSchema(
        page,
        PagePayload,
        `() => ({ headline: document.title, count: 1 })`
      )

      return `${visibleHeading}: ${payload.headline} (${payload.count})`
    }))

  return headline
}).pipe(Effect.scoped, Effect.provide(NodePlaywrightBrowser.layer))
