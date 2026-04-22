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

  it("supports semantic locator builders", () => {
    const role = page.getByRole("button", { name: "Save" })
    const text = page.getByText("Confirm")
    const label = page.getByLabel("Email")
    const placeholder = page.getByPlaceholder("name@example.com")
    const alt = page.getByAltText("Avatar")
    const title = page.getByTitle("Settings")
    const testId = page.getByTestId("dialog")

    expect(role).type.toBe<BrowserLocator.BrowserLocator>()
    expect(text).type.toBe<BrowserLocator.BrowserLocator>()
    expect(label).type.toBe<BrowserLocator.BrowserLocator>()
    expect(placeholder).type.toBe<BrowserLocator.BrowserLocator>()
    expect(alt).type.toBe<BrowserLocator.BrowserLocator>()
    expect(title).type.toBe<BrowserLocator.BrowserLocator>()
    expect(testId).type.toBe<BrowserLocator.BrowserLocator>()
  })

  it("separates navigation waitUntil from load state", () => {
    const navigation = page.goto("https://example.test/", { waitUntil: "commit" })
    const loadState = page.waitForLoadState("load")

    expect(navigation).type.toBe<Effect.Effect<void, BrowserError.BrowserError>>()
    expect(loadState).type.toBe<Effect.Effect<void, BrowserError.BrowserError>>()

    // @ts-expect-error Argument of type '"commit"' is not assignable to parameter of type 'BrowserLoadState'.
    page.waitForLoadState("commit")
  })
})

describe("BrowserLocator", () => {
  it("supports semantic composition", () => {
    const locator = page.getByRole("listitem")
    const nested = locator.getByRole("button", { name: "Add to cart" })
    const filtered = locator.filter({ hasText: "Product 2" })
    const intersected = page.getByRole("button").and(page.getByTitle("Subscribe"))
    const alternative = page.getByRole("button", { name: "New" }).or(page.getByText("Dialog"))
    const escaped = locator.locator(page.getByText("Child"))

    expect(locator).type.toBe<BrowserLocator.BrowserLocator>()
    expect(nested).type.toBe<BrowserLocator.BrowserLocator>()
    expect(filtered).type.toBe<BrowserLocator.BrowserLocator>()
    expect(intersected).type.toBe<BrowserLocator.BrowserLocator>()
    expect(alternative).type.toBe<BrowserLocator.BrowserLocator>()
    expect(escaped).type.toBe<BrowserLocator.BrowserLocator>()
  })

  it("exposes canonical read APIs", () => {
    const effect = page.getByText("Hello").textContent()
    const many = page.getByRole("listitem").allTextContents()
    const waited = page.getByText("Hello").waitFor({ state: "visible" })

    expect(effect).type.toBe<Effect.Effect<string, BrowserError.BrowserError>>()
    expect(many).type.toBe<Effect.Effect<ReadonlyArray<string>, BrowserError.BrowserError>>()
    expect(waited).type.toBe<Effect.Effect<void, BrowserError.BrowserError>>()
  })
})
