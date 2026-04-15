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

const nthValue = (values: ReadonlyArray<string>, index: number): string | undefined =>
  index >= 0 && index < values.length ? values[index] : undefined

const firstContext = (store: Store): ContextRec => Object.values(store.contexts)[0]!

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

        const makeLocator = (
          selector: string,
          rootSelector: string = "",
          index: number | undefined = undefined
        ): BrowserLocator.BrowserLocator => {
          const resolvedSelector = rootSelector === "" ? selector : `${rootSelector} ${selector}`
          const getLocatorPage = (
            operation: BrowserError.BrowserElementError["browserOperation"]
          ) =>
            Effect.fnUntraced(function*() {
              const page = yield* getPage(operation)
              const count = countMatches(page, resolvedSelector)
              if (index !== undefined) {
                if (index < 0 || index >= count) {
                  return yield* Effect.fail(
                    new BrowserError.BrowserElementError({
                      browserOperation: operation,
                      selector: resolvedSelector,
                      reason: "notFound",
                      description: "locator index out of range"
                    })
                  )
                }
              } else if (count === 0) {
                return yield* Effect.fail(
                  new BrowserError.BrowserElementError({
                    browserOperation: operation,
                    selector: resolvedSelector,
                    reason: "notFound",
                    description: "selector not present"
                  })
                )
              }
              return page
          })()

          return BrowserLocator.make({
            locator: (childSelector) => makeLocator(childSelector, resolvedSelector),
            nth: (nextIndex) => makeLocator(selector, rootSelector, nextIndex),
            click: () => getLocatorPage("locator.click").pipe(Effect.asVoid),
            fill: () => getLocatorPage("locator.fill").pipe(Effect.asVoid),
            press: () => getLocatorPage("locator.press").pipe(Effect.asVoid),
            hover: () => getLocatorPage("locator.hover").pipe(Effect.asVoid),
            scrollIntoViewIfNeeded: () => getLocatorPage("locator.scrollIntoViewIfNeeded").pipe(Effect.asVoid),
            waitFor: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getPage("locator.waitFor")
                if (countMatches(page, resolvedSelector) === 0) {
                  return yield* Effect.fail(
                    new BrowserError.BrowserTimeoutError({
                      browserOperation: "locator.waitFor",
                      selector: resolvedSelector,
                      description: "selector not present"
                    })
                  )
                }
                if (index !== undefined && (index < 0 || index >= countMatches(page, resolvedSelector))) {
                  return yield* Effect.fail(
                    new BrowserError.BrowserTimeoutError({
                      browserOperation: "locator.waitFor",
                      selector: resolvedSelector,
                      description: "locator index out of range"
                    })
                  )
                }
                return undefined
              })(),
            text: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.text")
                const values = textValues(page, resolvedSelector)
                return index === undefined ? values[0] ?? "" : nthValue(values, index) ?? ""
              })(),
            innerText: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.innerText")
                const values = textValues(page, resolvedSelector)
                return index === undefined ? values[0] ?? "" : nthValue(values, index) ?? ""
              })(),
            attribute: (name) =>
              Effect.fnUntraced(function*() {
                const page = yield* getLocatorPage("locator.attribute")
                return page.attrs[resolvedSelector]?.[name] ?? null
              })(),
            count: Effect.fnUntraced(function*() {
              const page = yield* getPage("locator.count")
              const count = countMatches(page, resolvedSelector)
              return index === undefined ? count : index >= 0 && index < count ? 1 : 0
            })(),
            allText: () =>
              Effect.fnUntraced(function*() {
                const page = yield* getPage("locator.allText")
                const values = textValues(page, resolvedSelector)
                if (index === undefined) {
                  return values
                }
                const value = nthValue(values, index)
                return value === undefined ? [] : [value]
              })()
          })
        }

        return BrowserPage.make({
          locator: (selector) => makeLocator(selector),
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

  it.effect("locator-first operations work", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": {
          title: "Locator",
          html: "<html></html>",
          texts: {
            "#search": "Search",
            "#hero": "Hero"
          },
          attrs: {
            "#hero": {
              "data-id": "42"
            }
          },
          textLists: {
            ".item": ["Alpha", "Beta", "Gamma"]
          },
          matchCounts: {
            ".item": 3
          }
        }
      })

      const values = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")

          const search = page.locator("#search")
          const items = page.locator(".item")

          yield* search.waitFor()
          yield* search.fill("pizza")
          yield* items.nth(1).click()

          return {
            heroText: yield* page.locator("#hero").text(),
            heroInnerText: yield* page.locator("#hero").innerText(),
            heroAttribute: yield* page.locator("#hero").attribute("data-id"),
            itemText: yield* items.nth(1).innerText(),
            count: yield* items.count,
            allText: yield* items.allText(),
            secondAllText: yield* items.nth(1).allText()
          }
        })).pipe(Effect.provide(fake.layer))

      assert.deepStrictEqual(values, {
        heroText: "Hero",
        heroInnerText: "Hero",
        heroAttribute: "42",
        itemText: "Beta",
        count: 3,
        allText: ["Alpha", "Beta", "Gamma"],
        secondAllText: ["Beta"]
      })
    }))

  it.effect("locator.locator supports scoped lookup", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({
        "https://example.test/": {
          title: "Scoped",
          html: "<html></html>",
          texts: {
            "#card .title": "Pizza Shop",
            "#card .status": "Open"
          }
        }
      })

      const values = yield* Browser.withPage(undefined, (page) =>
        Effect.gen(function*() {
          yield* page.goto("https://example.test/")
          const card = page.locator("#card")
          const title = card.locator(".title")
          const status = card.locator(".status")

          yield* title.waitFor()
          return {
            title: yield* title.text(),
            status: yield* status.text()
          }
        })).pipe(Effect.provide(fake.layer))

      assert.deepStrictEqual(values, {
        title: "Pizza Shop",
        status: "Open"
      })
    }))

  it.effect("locator failures use generic browser operations", () =>
    Effect.gen(function*() {
      const fake = makeFakeBrowserDriver({})

      const error = yield* Browser.withPage(undefined, (page) => page.locator(".missing").click()).pipe(
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
              selector: "#search"
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
            selector: "#search",
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
