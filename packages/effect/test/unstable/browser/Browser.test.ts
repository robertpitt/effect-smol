import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Ref, Schema } from "effect"
import * as Browser from "effect/unstable/browser/Browser"
import * as BrowserContext from "effect/unstable/browser/BrowserContext"
import * as BrowserDriver from "effect/unstable/browser/BrowserDriver"
import * as BrowserError from "effect/unstable/browser/BrowserError"
import * as BrowserLocator from "effect/unstable/browser/BrowserLocator"
import * as BrowserPage from "effect/unstable/browser/BrowserPage"

type RouteHit = {
  readonly title: string
  readonly html: string
  readonly texts?: Readonly<Record<string, string>>
  readonly attrs?: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly matchCounts?: Readonly<Record<string, number>>
  readonly textLists?: Readonly<Record<string, ReadonlyArray<string>>>
}

type PageRec = {
  readonly id: string
  closed: boolean
  url: string
  present: Set<string>
  texts: Record<string, string>
  attrs: Record<string, Record<string, string>>
  matchCounts: Record<string, number>
  textLists: Record<string, ReadonlyArray<string>>
}

type ContextRec = {
  readonly id: string
  closed: boolean
  readonly pages: Record<string, PageRec>
}

type Store = {
  readonly routes: Readonly<Record<string, RouteHit>>
  readonly contexts: Record<string, ContextRec>
  nextContextId: number
  nextPageId: number
}

type FakeLocatorIndex = number | "last" | undefined

interface FakeLocatorPrimitive extends BrowserLocator.BrowserLocatorPrimitive {
  readonly selector: string
  readonly index: FakeLocatorIndex
}

const makeStore = (routes: Readonly<Record<string, RouteHit>>): Store => ({
  routes,
  contexts: {},
  nextContextId: 1,
  nextPageId: 1
})

const newPageRec = (id: string): PageRec => ({
  id,
  closed: false,
  url: "",
  present: new Set<string>(),
  texts: {},
  attrs: {},
  matchCounts: {},
  textLists: {}
})

const loadRoute = (page: PageRec, hit: RouteHit | undefined) => {
  page.present = new Set<string>()
  page.texts = {}
  page.attrs = {}
  page.matchCounts = {}
  page.textLists = {}

  if (hit === undefined) {
    return
  }

  if (hit.texts !== undefined) {
    for (const [selector, text] of Object.entries(hit.texts)) {
      page.present.add(selector)
      page.texts[selector] = text
      page.matchCounts[selector] = 1
    }
  }

  if (hit.attrs !== undefined) {
    for (const [selector, attributes] of Object.entries(hit.attrs)) {
      page.present.add(selector)
      page.attrs[selector] = { ...attributes }
      page.matchCounts[selector] ??= 1
    }
  }

  if (hit.textLists !== undefined) {
    for (const [selector, values] of Object.entries(hit.textLists)) {
      page.present.add(selector)
      page.textLists[selector] = values
      page.matchCounts[selector] = values.length
    }
  }

  if (hit.matchCounts !== undefined) {
    for (const [selector, count] of Object.entries(hit.matchCounts)) {
      page.present.add(selector)
      page.matchCounts[selector] = count
    }
  }
}

const countMatches = (page: PageRec, selector: string): number => {
  if (Object.prototype.hasOwnProperty.call(page.matchCounts, selector)) {
    return page.matchCounts[selector]!
  }
  if (page.textLists[selector] !== undefined) {
    return page.textLists[selector]!.length
  }
  return page.present.has(selector) ? 1 : 0
}

const textValues = (page: PageRec, selector: string): ReadonlyArray<string> => {
  if (page.textLists[selector] !== undefined) {
    return page.textLists[selector]!
  }
  if (countMatches(page, selector) === 0) {
    return []
  }
  return [page.texts[selector] ?? ""]
}

const resolveIndex = (index: FakeLocatorIndex, count: number): number | undefined => {
  if (index === undefined) {
    return undefined
  }
  if (index === "last") {
    return count > 0 ? count - 1 : undefined
  }
  return index >= 0 && index < count ? index : undefined
}

const resolveText = (page: PageRec, selector: string, index: FakeLocatorIndex): string => {
  const values = textValues(page, selector)
  const resolved = resolveIndex(index, values.length)
  return resolved === undefined ? values[0] ?? "" : values[resolved] ?? ""
}

const resolveTextList = (page: PageRec, selector: string, index: FakeLocatorIndex): ReadonlyArray<string> => {
  const values = textValues(page, selector)
  const resolved = resolveIndex(index, values.length)
  return resolved === undefined ? values : resolved < values.length ? [values[resolved]!] : []
}

const resolveCount = (page: PageRec, selector: string, index: FakeLocatorIndex): number => {
  const count = countMatches(page, selector)
  return index === undefined ? count : resolveIndex(index, count) === undefined ? 0 : 1
}

const firstContext = (store: Store): ContextRec => Object.values(store.contexts)[0]!

const toFakePrimitive = (self: BrowserLocator.BrowserLocator): FakeLocatorPrimitive =>
  BrowserLocator.toPrimitive(self) as FakeLocatorPrimitive

const describeTextMatcher = (matcher: BrowserLocator.BrowserTextMatcher): string =>
  typeof matcher === "string" ? JSON.stringify(matcher) : matcher.toString()

const describeExactOptions = (options: BrowserLocator.BrowserExactTextOptions | undefined): string =>
  options?.exact === true ? ", exact: true" : ""

const describeRoleOptions = (options: BrowserLocator.GetByRoleOptions | undefined): string => {
  const parts: Array<string> = []
  if (options?.name !== undefined) {
    parts.push(`name: ${describeTextMatcher(options.name)}`)
  }
  if (options?.exact === true) {
    parts.push("exact: true")
  }
  return parts.length === 0 ? "" : `, { ${parts.join(", ")} }`
}

const describeFilterOptions = (options: BrowserLocator.BrowserLocatorFilterOptions): string => {
  const parts: Array<string> = []
  if (options.has !== undefined) {
    parts.push(`has: ${toFakePrimitive(options.has).selector}`)
  }
  if (options.hasNot !== undefined) {
    parts.push(`hasNot: ${toFakePrimitive(options.hasNot).selector}`)
  }
  if (options.hasText !== undefined) {
    parts.push(`hasText: ${describeTextMatcher(options.hasText)}`)
  }
  if (options.hasNotText !== undefined) {
    parts.push(`hasNotText: ${describeTextMatcher(options.hasNotText)}`)
  }
  if (options.visible !== undefined) {
    parts.push(`visible: ${String(options.visible)}`)
  }
  return parts.join(", ")
}

const fromSelectorArg = (selector: string | BrowserLocator.BrowserLocator): string =>
  typeof selector === "string" ? selector : toFakePrimitive(selector).selector

const makeFakeBrowserDriver = (routes: Readonly<Record<string, RouteHit>>) => {
  const store = makeStore(routes)

  const service: BrowserDriver.BrowserDriverService = {
    launch: Effect.fnUntraced(function*() {
      const contextId = `c-${store.nextContextId++}`
      const contextRec: ContextRec = {
        id: contextId,
        closed: false,
        pages: {}
      }
      store.contexts[contextId] = contextRec

      const closeContext = Effect.sync(() => {
        if (contextRec.closed) {
          return
        }
        contextRec.closed = true
        for (const page of Object.values(contextRec.pages)) {
          page.closed = true
        }
      })

      yield* Effect.addFinalizer(() => closeContext)

      const makePage = (pageRec: PageRec): BrowserPage.BrowserPage => {
        const getPage = (operation: BrowserError.BrowserOperation) =>
          Effect.fnUntraced(function*() {
            if (contextRec.closed || pageRec.closed) {
              return yield* Effect.fail(
                new BrowserError.BrowserClosedError({ browserOperation: operation })
              )
            }
            return pageRec
          })()

        const makeLocator = (selector: string, index: FakeLocatorIndex = undefined): BrowserLocator.BrowserLocator => {
          const getLocatorPage = (
            operation: BrowserError.BrowserElementError["browserOperation"]
          ) =>
            Effect.fnUntraced(function*() {
              const page = yield* getPage(operation)
              const count = countMatches(page, selector)
              if (count === 0 || (index !== undefined && resolveIndex(index, count) === undefined)) {
                return yield* Effect.fail(
                  new BrowserError.BrowserElementError({
                    browserOperation: operation,
                    selector,
                    reason: "notFound",
                    description: "selector not present"
                  })
                )
              }
              return page
            })()

          const primitive: FakeLocatorPrimitive = {
            selector,
            index,
            locator: (childSelector) => makeLocator(`${selector} >> ${fromSelectorArg(childSelector)}`),
            getByRole: (role, options) => makeLocator(`${selector} >> role=${role}${describeRoleOptions(options)}`),
            getByText: (text, options) =>
              makeLocator(`${selector} >> text=${describeTextMatcher(text)}${describeExactOptions(options)}`),
            getByLabel: (text, options) =>
              makeLocator(`${selector} >> label=${describeTextMatcher(text)}${describeExactOptions(options)}`),
            getByPlaceholder: (text, options) =>
              makeLocator(`${selector} >> placeholder=${describeTextMatcher(text)}${describeExactOptions(options)}`),
            getByAltText: (text, options) =>
              makeLocator(`${selector} >> alt=${describeTextMatcher(text)}${describeExactOptions(options)}`),
            getByTitle: (text, options) =>
              makeLocator(`${selector} >> title=${describeTextMatcher(text)}${describeExactOptions(options)}`),
            getByTestId: (testId) => makeLocator(`${selector} >> testId=${describeTextMatcher(testId)}`),
            filter: (options) => makeLocator(`${selector} >> filter(${describeFilterOptions(options)})`),
            and: (that) => makeLocator(`${selector} && ${toFakePrimitive(that).selector}`),
            or: (that) => makeLocator(`${selector} || ${toFakePrimitive(that).selector}`),
            first: () => makeLocator(selector, 0),
            last: () => makeLocator(selector, "last"),
            nth: (nextIndex) => makeLocator(selector, nextIndex),
            click: () => getLocatorPage("locator.click").pipe(Effect.asVoid),
            fill: () => getLocatorPage("locator.fill").pipe(Effect.asVoid),
            press: () => getLocatorPage("locator.press").pipe(Effect.asVoid),
            hover: () => getLocatorPage("locator.hover").pipe(Effect.asVoid),
            scrollIntoViewIfNeeded: () => getLocatorPage("locator.scrollIntoViewIfNeeded").pipe(Effect.asVoid),
            waitFor: (options) =>
              Effect.fnUntraced(function*() {
                const page = yield* getPage("locator.waitFor")
                const count = countMatches(page, selector)
                const visible = count > 0 && (index === undefined || resolveIndex(index, count) !== undefined)
                switch (options?.state) {
                  case "detached":
                  case "hidden": {
                    if (visible) {
                      return yield* Effect.fail(
                        new BrowserError.BrowserTimeoutError({
                          browserOperation: "locator.waitFor",
                          selector,
                          description: "selector still present"
                        })
                      )
                    }
                    return undefined
                  }
                  default: {
                    if (!visible) {
                      return yield* Effect.fail(
                        new BrowserError.BrowserTimeoutError({
                          browserOperation: "locator.waitFor",
                          selector,
                          description: "selector not present"
                        })
                      )
                    }
                    return undefined
                  }
                }
              })(),
            textContent: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.text")
                return resolveText(page, selector, index)
              })(),
            innerText: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.innerText")
                return resolveText(page, selector, index)
              })(),
            attribute: (name) =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.attribute")
                return page.attrs[selector]?.[name] ?? null
              })(),
            count: Effect.fnUntraced(function*() {
              const page = yield* getPage("locator.count")
              return resolveCount(page, selector, index)
            })(),
            allTextContents: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getPage("locator.allText")
                return resolveTextList(page, selector, index)
              })()
          }

          return BrowserLocator.make(primitive)
        }

        const getPageLocator = (selector: string) => makeLocator(selector)

        return BrowserPage.make({
          locator: (selector) => getPageLocator(fromSelectorArg(selector)),
          getByRole: (role, options) => getPageLocator(`role=${role}${describeRoleOptions(options)}`),
          getByText: (text, options) =>
            getPageLocator(`text=${describeTextMatcher(text)}${describeExactOptions(options)}`),
          getByLabel: (text, options) =>
            getPageLocator(`label=${describeTextMatcher(text)}${describeExactOptions(options)}`),
          getByPlaceholder: (text, options) =>
            getPageLocator(`placeholder=${describeTextMatcher(text)}${describeExactOptions(options)}`),
          getByAltText: (text, options) =>
            getPageLocator(`alt=${describeTextMatcher(text)}${describeExactOptions(options)}`),
          getByTitle: (text, options) =>
            getPageLocator(`title=${describeTextMatcher(text)}${describeExactOptions(options)}`),
          getByTestId: (testId) => getPageLocator(`testId=${describeTextMatcher(testId)}`),
          goto: (url) =>
            getPage("page.goto").pipe(Effect.andThen(Effect.sync(() => {
              const target = typeof url === "string" ? url : url.toString()
              pageRec.url = target
              loadRoute(pageRec, store.routes[target])
            }))),
          reload: () => getPage("page.reload").pipe(Effect.asVoid),
          goBack: () => getPage("page.goBack").pipe(Effect.asVoid),
          waitForURL: (url) =>
            Effect.fnUntraced(function*() {
              const page = yield* getPage("page.waitForURL")
              const target = typeof url === "string" ? url : url.toString()
              if (page.url !== target) {
                return yield* Effect.fail(
                  new BrowserError.BrowserTimeoutError({
                    browserOperation: "page.waitForURL",
                    url: target
                  })
                )
              }
              return undefined
            })(),
          waitForLoadState: () => getPage("page.waitForLoadState").pipe(Effect.asVoid),
          title: Effect.fnUntraced(function*() {
            const page = yield* getPage("page.title")
            return store.routes[page.url]?.title ?? ""
          })(),
          content: Effect.fnUntraced(function*() {
            const page = yield* getPage("page.content")
            return store.routes[page.url]?.html ?? "<html></html>"
          })(),
          evaluate: (pageFunction, arg) =>
            Effect.fnUntraced(function*() {
              yield* getPage("page.evaluate")
              if (pageFunction === "__badSyntax__") {
                return yield* Effect.fail(
                  new BrowserError.BrowserEvaluateError({
                    browserOperation: "page.evaluate",
                    kind: "parse",
                    cause: new Error("page.evaluate: SyntaxError: fake"),
                    description: "page.evaluate: SyntaxError: fake"
                  })
                )
              }
              return arg ?? null
            })(),
          screenshot: () =>
            Effect.fnUntraced(function*() {
              yield* getPage("page.screenshot")
              return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
            })(),
          close: Effect.sync(() => {
            pageRec.closed = true
          })
        })
      }

      return BrowserContext.make({
        newPage: Effect.fnUntraced(function*() {
          if (contextRec.closed) {
            return yield* Effect.fail(
              new BrowserError.BrowserClosedError({ browserOperation: "context.newPage" })
            )
          }
          const pageId = `p-${store.nextPageId++}`
          const pageRec = newPageRec(pageId)
          contextRec.pages[pageId] = pageRec
          const page = makePage(pageRec)
          yield* Effect.addFinalizer(() => page.close.pipe(Effect.ignore))
          return page
        })(),
        close: closeContext
      })
    })
  }

  return {
    store,
    service,
    layer: Layer.succeed(BrowserDriver.BrowserDriver, BrowserDriver.BrowserDriver.of(service))
  }
}

describe("unstable/browser", () => {
  it.effect("Browser.withContext scopes context teardown", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Hello", html: "<html></html>" }
      })

      const title = yield* Browser.withContext(undefined, (context) =>
        BrowserContext.withPage(context, (page) =>
          Effect.gen(function*() {
            yield* page.goto("https://example.test/")
            return yield* page.title
          }))).pipe(Effect.provide(fake.layer))

      const context = firstContext(fake.store)

      assert.strictEqual(title, "Hello")
      assert.isTrue(context.closed)
      assert.isTrue(Object.values(context.pages)[0]!.closed)
    }))

  it.effect("Browser.withPage scopes launch and page teardown", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Top level", html: "<html></html>" }
      })

      const title = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          return yield* page.title
        })).pipe(Effect.provide(fake.layer))

      assert.strictEqual(title, "Top level")
      assert.isTrue(firstContext(fake.store).closed)
    }))

  it.effect("BrowserContext.withPage closes only the inner page", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Page", html: "<html></html>" }
      })

      const title = yield* Browser.withContext(undefined, (context) =>
        Effect.gen(function*() {
          yield* BrowserContext.withPage(context, (page) => page.goto("https://example.test/"))

          const contextRec = firstContext(fake.store)
          assert.isFalse(contextRec.closed)
          assert.strictEqual(Object.keys(contextRec.pages).length, 1)
          assert.isTrue(Object.values(contextRec.pages)[0]!.closed)

          return yield* BrowserContext.withPage(context, (page) =>
            Effect.gen(function*() {
              yield* page.goto("https://example.test/")
              return yield* page.title
            }))
        })).pipe(Effect.provide(fake.layer))

      assert.strictEqual(title, "Page")
    }))

  it.effect("page and context close are idempotent", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({})

      yield* Browser.withContext(undefined, (context) =>
        Effect.gen(function*() {
          yield* BrowserContext.withPage(context, (page) =>
            Effect.gen(function*() {
              yield* page.close
              yield* page.close
            }))
          yield* context.close
          yield* context.close
        })).pipe(Effect.provide(fake.layer))

      const contextRec = firstContext(fake.store)
      assert.isTrue(contextRec.closed)
      assert.isTrue(Object.values(contextRec.pages)[0]!.closed)
    }))

  it.effect("semantic locators and composition work", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": {
          title: "Locator",
          html: "<html></html>",
          texts: {
            "label=\"Search\"": "Search",
            "role=heading, { name: \"Hero\" }": "Hero",
            "role=heading, { name: \"Hero\" } >> title=\"Hero title\"": "Hero title",
            "testId=\"hero\"": "Hero",
            "role=button && title=\"Subscribe\"": "Subscribe"
          },
          attrs: {
            "testId=\"hero\"": {
              "data-id": "42"
            }
          },
          textLists: {
            "role=listitem": ["Product 1", "Product 2", "Product 3"],
            "role=listitem >> filter(hasText: \"Product 2\")": ["Product 2"],
            "role=listitem >> filter(hasText: \"Product 2\") >> role=button, { name: \"Add to cart\" }": [
              "Add to cart"
            ],
            "role=listitem >> filter(visible: true)": ["Product 1", "Product 2"],
            "role=listitem >> filter(has: testId=\"product-badge\")": ["Product 2"],
            "role=listitem >> filter(hasNot: title=\"Archived\")": ["Product 1", "Product 2"],
            "role=button, { name: \"New\" } || text=\"Confirm security settings\"": [
              "New",
              "Confirm security settings"
            ]
          },
          matchCounts: {
            "role=listitem": 3,
            "role=listitem >> filter(hasText: \"Product 2\")": 1,
            "role=listitem >> filter(hasText: \"Product 2\") >> role=button, { name: \"Add to cart\" }": 1,
            "role=listitem >> filter(visible: true)": 2,
            "role=listitem >> filter(has: testId=\"product-badge\")": 1,
            "role=listitem >> filter(hasNot: title=\"Archived\")": 2,
            "role=button && title=\"Subscribe\"": 1,
            "role=button, { name: \"New\" } || text=\"Confirm security settings\"": 2
          }
        }
      })

      const values = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")

          const search = page.getByLabel("Search")
          const items = page.getByRole("listitem")
          const newEmail = page.getByRole("button", { name: "New" })
          const dialog = page.getByText("Confirm security settings")

          yield* search.waitFor({ state: "visible" })
          yield* search.fill("pizza")
          yield* items.filter({ hasText: "Product 2" }).getByRole("button", { name: "Add to cart" }).click()

          return {
            heroText: yield* page.getByRole("heading", { name: "Hero" }).textContent(),
            heroInnerText: yield* page.getByTestId("hero").innerText(),
            heroAttribute: yield* page.getByTestId("hero").attribute("data-id"),
            titleText: yield* page.getByRole("heading", { name: "Hero" }).getByTitle("Hero title").textContent(),
            secondItem: yield* items.nth(1).innerText(),
            lastItem: yield* items.last().innerText(),
            count: yield* items.count,
            allText: yield* items.allTextContents(),
            filteredVisible: yield* items.filter({ visible: true }).allTextContents(),
            filteredHas: yield* items.filter({ has: page.getByTestId("product-badge") }).allTextContents(),
            filteredHasNot: yield* items.filter({ hasNot: page.getByTitle("Archived") }).allTextContents(),
            intersection: yield* page.getByRole("button").and(page.getByTitle("Subscribe")).textContent(),
            alternative: yield* newEmail.or(dialog).first().textContent()
          }
        })).pipe(Effect.provide(fake.layer))

      assert.deepStrictEqual(values, {
        heroText: "Hero",
        heroInnerText: "Hero",
        heroAttribute: "42",
        titleText: "Hero title",
        secondItem: "Product 2",
        lastItem: "Product 3",
        count: 3,
        allText: ["Product 1", "Product 2", "Product 3"],
        filteredVisible: ["Product 1", "Product 2"],
        filteredHas: ["Product 2"],
        filteredHasNot: ["Product 1", "Product 2"],
        intersection: "Subscribe",
        alternative: "New"
      })
    }))

  it.effect("waitFor supports attached and hidden states", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": {
          title: "Wait",
          html: "<html></html>",
          texts: {
            "text=\"Visible\"": "Visible"
          }
        }
      })

      yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          yield* page.getByText("Visible").waitFor({ state: "attached" })
          yield* page.getByText("Missing").waitFor({ state: "hidden" })
        })).pipe(Effect.provide(fake.layer))
    }))

  it.effect("navigation methods accept commit waitUntil", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Commit", html: "<html></html>" }
      })

      yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/", { waitUntil: "commit" })
          yield* page.reload({ waitUntil: "commit" })
          yield* page.goBack({ waitUntil: "commit" })
          yield* page.waitForURL("https://example.test/", { waitUntil: "commit" })
        })).pipe(Effect.provide(fake.layer))
    }))

  it.effect("locator failures use generic browser operations", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({})

      const error = yield* Browser.withPage(undefined, (page) => page.getByText("missing").click()).pipe(
        Effect.flip,
        Effect.provide(fake.layer)
      )

      assert.ok(BrowserError.isBrowserElementError(error))
      assert.strictEqual(error.browserOperation, "locator.click")
    }))

  it.effect("BrowserDriver.tapLaunch runs before launch", () =>
    Effect.gen(function*() {
      const taps = yield* Ref.make(0)
      const fake = makeFakeBrowserDriver({})
      const layer = Layer.succeed(
        BrowserDriver.BrowserDriver,
        BrowserDriver.BrowserDriver.of(
          BrowserDriver.tapLaunch(fake.service, () => Ref.update(taps, (n) => n + 1))
        )
      )

      yield* Browser.withContext(undefined, () => Effect.void).pipe(Effect.provide(layer))

      assert.strictEqual(yield* Ref.get(taps), 1)
    }))

  it.effect("BrowserDriver.transform can wrap launch", () =>
    Effect.gen(function*() {
      const taps = yield* Ref.make(0)
      const fake = makeFakeBrowserDriver({})
      const layer = Layer.succeed(
        BrowserDriver.BrowserDriver,
        BrowserDriver.BrowserDriver.of(
          BrowserDriver.transform(
            fake.service,
            (effect) => effect.pipe(Effect.tap(() => Ref.update(taps, (n) => n + 1)))
          )
        )
      )

      yield* Browser.withContext(undefined, () => Effect.void).pipe(Effect.provide(layer))

      assert.strictEqual(yield* Ref.get(taps), 1)
    }))

  it.effect("BrowserPage.evaluateSchema decodes evaluate results", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Eval", html: "<html></html>" }
      })
      const schema = Schema.Struct({ n: Schema.Number })

      const decoded = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          return yield* BrowserPage.evaluateSchema(page, schema, (value: unknown) => value, { n: 7 })
        })).pipe(Effect.provide(fake.layer))

      assert.strictEqual(decoded.n, 7)
    }))

  it.effect("BrowserPage.evaluateSchema surfaces SchemaError", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Eval", html: "<html></html>" }
      })
      const schema = Schema.Struct({ n: Schema.Number })

      const exit = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          return yield* BrowserPage.evaluateSchema(page, schema, (value: unknown) => value, { n: "x" })
        })).pipe(Effect.exit, Effect.provide(fake.layer))

      assert.strictEqual(exit._tag, "Failure")
    }))

  it.effect("BrowserEvaluateError remains catchable by tag", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": { title: "Eval", html: "<html></html>" }
      })

      const error = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          return yield* page.evaluate("__badSyntax__")
        })).pipe(Effect.flip, Effect.provide(fake.layer))

      assert.ok(BrowserError.isBrowserEvaluateError(error))
      assert.strictEqual(error.browserOperation, "page.evaluate")
      assert.strictEqual(error.kind, "parse")
    }))

  it.effect("BrowserError.isRetryableDomError supports retry policies", () =>
    Effect.gen(function*() {
      let attempts = 0

      const value = yield* Effect.fnUntraced(function*() {
        attempts += 1
        if (attempts < 3) {
          return yield* Effect.fail(
            new BrowserError.BrowserTimeoutError({
              browserOperation: "locator.waitFor",
              selector: "text=\"Search\""
            })
          )
        }
        return "ok"
      })().pipe(
        Effect.retry({ while: BrowserError.isRetryableDomError })
      )

      assert.strictEqual(value, "ok")
      assert.strictEqual(attempts, 3)
      assert.isTrue(
        BrowserError.isRetryableDomError(
          new BrowserError.BrowserElementError({
            browserOperation: "locator.click",
            selector: "text=\"Search\"",
            reason: "notFound"
          })
        )
      )
      assert.isFalse(
        BrowserError.isRetryableDomError(
          new BrowserError.BrowserTimeoutError({
            browserOperation: "page.waitForURL",
            url: "https://example.test/"
          })
        )
      )
    }))
})
