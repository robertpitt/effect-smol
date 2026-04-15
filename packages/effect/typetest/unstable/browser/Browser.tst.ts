import type { Effect } from "effect"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import * as Browser from "effect/unstable/browser/Browser"
import * as BrowserContext from "effect/unstable/browser/BrowserContext"
import type * as BrowserDriver from "effect/unstable/browser/BrowserDriver"
import type * as BrowserError from "effect/unstable/browser/BrowserError"
import * as BrowserLocator from "effect/unstable/browser/BrowserLocator"
import * as BrowserPage from "effect/unstable/browser/BrowserPage"
import { describe, expect, it } from "tstyche"

declare const context: BrowserContext.BrowserContext
declare const page: BrowserPage.BrowserPage

describe("Browser", () => {
  it("launch should acquire a BrowserContext", () => {
    const effect = Browser.launch()

    expect(effect).type.toBe<
      Effect.Effect<
        BrowserContext.BrowserContext,
        BrowserError.BrowserError,
        BrowserDriver.BrowserDriver | Scope.Scope
      >
    >()
  })

  it("withContext should scope the browser context", () => {
    const effect = Browser.withContext(undefined, (context) => context.close)

    expect(effect).type.toBe<
      Effect.Effect<void, BrowserError.BrowserError, BrowserDriver.BrowserDriver | Scope.Scope>
    >()
  })

  it("withPage should scope launch plus a single page", () => {
    const effect = Browser.withPage(undefined, (page) => page.title)

    expect(effect).type.toBe<
      Effect.Effect<string, BrowserError.BrowserError, BrowserDriver.BrowserDriver | Scope.Scope>
    >()
  })
})

describe("BrowserContext", () => {
  it("withPage should scope a page from an existing context", () => {
    const effect = BrowserContext.withPage(context, (page) => page.title)

    expect(effect).type.toBe<
      Effect.Effect<string, BrowserError.BrowserError>
    >()
  })
})

describe("BrowserPage", () => {
  it("evaluateSchema should decode the evaluate result", () => {
    const schema = Schema.Struct({ n: Schema.Number })
    const effect = BrowserPage.evaluateSchema(page, schema, (value: unknown) => value, { n: 1 })

    expect(effect).type.toBe<
      Effect.Effect<
        { readonly n: number },
        BrowserError.BrowserError | Schema.SchemaError
      >
    >()
  })
})

describe("BrowserLocator", () => {
  it("supports scoped locator chaining", () => {
    const locator = page.locator("#card")
    const nested = locator.locator(".title")

    expect(locator).type.toBe<BrowserLocator.BrowserLocator>()
    expect(nested).type.toBe<BrowserLocator.BrowserLocator>()
  })
})
