/**
 * Opt-in Playwright-backed {@link BrowserDriver} layer for Node.js.
 *
 * Install `playwright` in your application and run `npx playwright install` to
 * download browsers before using this layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Browser from "effect/unstable/browser/Browser"
 * import * as NodePlaywrightBrowser from "@effect/platform-node/NodePlaywrightBrowser"
 *
 * const program = Effect.gen(function*() {
 *   return yield* Browser.withPage({ headless: true }, (page) =>
 *     Effect.gen(function*() {
 *       yield* page.goto("https://example.com/")
 *       return yield* page.title
 *     })
 *   )
 * }).pipe(Effect.scoped, Effect.provide(NodePlaywrightBrowser.layer))
 * ```
 *
 * @since 4.0.0
 */
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as BrowserContext from "effect/unstable/browser/BrowserContext"
import * as BrowserDriver from "effect/unstable/browser/BrowserDriver"
import * as BrowserError from "effect/unstable/browser/BrowserError"
import * as BrowserLocator from "effect/unstable/browser/BrowserLocator"
import * as BrowserPage from "effect/unstable/browser/BrowserPage"
import {
  type Browser as PlaywrightBrowser,
  type BrowserContext as PlaywrightBrowserContext,
  type BrowserContextOptions,
  chromium,
  errors,
  type Locator,
  type Page,
  type PageScreenshotOptions
} from "playwright"

// Shared Playwright defaults and option normalization.
const toTimeoutMs = (input: Duration.Input | undefined, fallback: number): number =>
  input === undefined ? fallback : Duration.toMillis(Duration.fromInputUnsafe(input))

const DEFAULT_TIMEOUT_MILLIS = 30_000

const toDefaultTimeoutMs = (input: Duration.Input | undefined): number => toTimeoutMs(input, DEFAULT_TIMEOUT_MILLIS)

const toErrorMessage = (cause: unknown): string | undefined => cause instanceof Error ? cause.message : undefined

const withTimeout = (timeout: Duration.Input | undefined): { timeout: number } => ({
  timeout: toDefaultTimeoutMs(timeout)
})

const toTarget = (url: string | URL): string => typeof url === "string" ? url : url.toString()

const toPressOptions = (
  options: BrowserLocator.PressOptions | undefined
): { timeout: number; delay?: number } => {
  const pressOptions: { timeout: number; delay?: number } = {
    timeout: toDefaultTimeoutMs(options?.timeout)
  }
  if (options?.delay !== undefined) {
    pressOptions.delay = Duration.toMillis(Duration.fromInputUnsafe(options.delay))
  }
  return pressOptions
}

const toWaitUntilOptions = (
  options:
    | BrowserPage.GotoOptions
    | BrowserPage.ReloadOptions
    | BrowserPage.WaitForURLOptions
    | undefined
): { timeout: number; waitUntil?: BrowserPage.BrowserWaitUntil } => {
  const waitOptions: {
    timeout: number
    waitUntil?: BrowserPage.BrowserWaitUntil
  } = {
    timeout: toDefaultTimeoutMs(options?.timeout)
  }
  if (options?.waitUntil !== undefined) {
    waitOptions.waitUntil = options.waitUntil
  }
  return waitOptions
}

const toScreenshotOptions = (
  options: BrowserPage.ScreenshotOptions | undefined
): PageScreenshotOptions => {
  const screenshotOptions: PageScreenshotOptions = {}
  if (options?.fullPage !== undefined) {
    screenshotOptions.fullPage = options.fullPage
  }
  if (options?.type !== undefined) {
    screenshotOptions.type = options.type
  }
  if (options?.quality !== undefined) {
    screenshotOptions.quality = options.quality
  }
  return screenshotOptions
}

const toContextOptions = (
  options: BrowserDriver.BrowserLaunchOptions | undefined
): BrowserContextOptions => {
  const contextOptions: BrowserContextOptions = {}
  if (options?.viewport !== undefined) {
    contextOptions.viewport = options.viewport
  }
  if (options?.userAgent !== undefined) {
    contextOptions.userAgent = options.userAgent
  }
  if (options?.locale !== undefined) {
    contextOptions.locale = options.locale
  }
  return contextOptions
}

const tryVoid = <E>(
  options: {
    readonly try: () => Promise<unknown>
    readonly catch: (cause: unknown) => E
  }
): Effect.Effect<void, E> => Effect.tryPromise(options).pipe(Effect.asVoid)

// Error mapping stays centralized so the public implementations read as workflow code.
const mapUnknown = (
  operation: BrowserError.BrowserOperation,
  cause: unknown,
  extra?: { readonly selector?: string; readonly url?: string }
): BrowserError.BrowserUnknownError =>
  new BrowserError.BrowserUnknownError({
    browserOperation: operation,
    cause,
    description: toErrorMessage(cause),
    ...extra
  })

const mapLaunchFailure = (
  operation: "browser.launch" | "context.newPage",
  cause: unknown
): BrowserError.BrowserLaunchError =>
  new BrowserError.BrowserLaunchError({
    browserOperation: operation,
    cause,
    description: toErrorMessage(cause)
  })

const mapNavigationFailure = (
  operation: BrowserError.BrowserNavigationError["browserOperation"],
  url: string,
  cause: unknown
): BrowserError.BrowserNavigationError =>
  new BrowserError.BrowserNavigationError({
    browserOperation: operation,
    url,
    cause,
    description: toErrorMessage(cause)
  })

const mapEvaluateCause = (cause: unknown): BrowserError.BrowserEvaluateError | BrowserError.BrowserUnknownError => {
  if (!(cause instanceof Error)) {
    return mapUnknown("page.evaluate", cause)
  }
  const description = cause.message
  const inPageEvaluate = description.includes("page.evaluate:") ||
    description.includes("UtilityScript.evaluate")
  if (!inPageEvaluate) {
    return mapUnknown("page.evaluate", cause)
  }
  const kind: BrowserError.BrowserEvaluateError["kind"] = /\bSyntaxError\b/.test(description) ?
    "parse" :
    /\bReferenceError\b/.test(description) || /\bTypeError\b/.test(description) ?
    "runtime" :
    "other"
  return new BrowserError.BrowserEvaluateError({
    browserOperation: "page.evaluate",
    kind,
    cause,
    description
  })
}

const mapLocatorFailure = (
  operation: BrowserError.BrowserElementError["browserOperation"],
  selector: string,
  cause: unknown,
  reason: BrowserError.BrowserElementError["reason"] = "other"
): BrowserError.BrowserError =>
  cause instanceof errors.TimeoutError ?
    new BrowserError.BrowserTimeoutError({
      browserOperation: operation,
      selector,
      description: toErrorMessage(cause)
    }) :
    new BrowserError.BrowserElementError({
      browserOperation: operation,
      selector,
      reason,
      cause,
      description: toErrorMessage(cause)
    })

const mapWaitForURLFailure = (
  target: string,
  cause: unknown
): BrowserError.BrowserError =>
  cause instanceof errors.TimeoutError ?
    new BrowserError.BrowserTimeoutError({
      browserOperation: "page.waitForURL",
      url: target,
      description: toErrorMessage(cause)
    }) :
    mapNavigationFailure("page.waitForURL", target, cause)

const mapWaitForLoadStateFailure = (cause: unknown): BrowserError.BrowserError =>
  cause instanceof errors.TimeoutError ?
    new BrowserError.BrowserTimeoutError({
      browserOperation: "page.waitForLoadState",
      description: toErrorMessage(cause)
    }) :
    mapUnknown("page.waitForLoadState", cause)

const makeLocator = (locator: Locator, selector: string): BrowserLocator.BrowserLocator =>
  BrowserLocator.make({
    locator: (childSelector) =>
      makeLocator(locator.locator(childSelector), `${selector} ${childSelector}`),
    nth: (index) => makeLocator(locator.nth(index), selector),
    click: (options) =>
      tryVoid({
        try: () => locator.click(withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.click", selector, cause)
      }),
    fill: (value, options) =>
      Effect.gen(function*() {
        const timeout = toDefaultTimeoutMs(options?.timeout)
        if (options?.clear === true) {
          yield* Effect.tryPromise({
            try: () => locator.clear({ timeout }),
            catch: (cause) => mapLocatorFailure("locator.fill", selector, cause, "notActionable")
          })
        }
        yield* Effect.tryPromise({
          try: () => locator.fill(value, { timeout }),
          catch: (cause) => mapLocatorFailure("locator.fill", selector, cause)
        })
        return undefined
      }),
    press: (key, options) =>
      tryVoid({
        try: () => locator.press(key, toPressOptions(options)),
        catch: (cause) => mapLocatorFailure("locator.press", selector, cause)
      }),
    hover: (options) =>
      tryVoid({
        try: () => locator.hover(withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.hover", selector, cause)
      }),
    scrollIntoViewIfNeeded: (options) =>
      tryVoid({
        try: () => locator.scrollIntoViewIfNeeded(withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.scrollIntoViewIfNeeded", selector, cause)
      }),
    waitFor: (options) =>
      tryVoid({
        try: () => locator.waitFor(withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.waitFor", selector, cause, "notFound")
      }),
    text: (options) =>
      Effect.tryPromise({
        try: () => locator.textContent(withTimeout(options?.timeout)).then((value) => value ?? ""),
        catch: (cause) => mapLocatorFailure("locator.text", selector, cause)
      }),
    innerText: (options) =>
      Effect.tryPromise({
        try: () => locator.innerText(withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.innerText", selector, cause)
      }),
    attribute: (name, options) =>
      Effect.tryPromise({
        try: () => locator.getAttribute(name, withTimeout(options?.timeout)),
        catch: (cause) => mapLocatorFailure("locator.attribute", selector, cause)
      }),
    count: Effect.tryPromise({
      try: () => locator.count(),
      catch: (cause) =>
        new BrowserError.BrowserElementError({
          browserOperation: "locator.count",
          selector,
          reason: "other",
          cause,
          description: toErrorMessage(cause)
        })
    }),
    allText: (options) =>
      Effect.tryPromise({
        try: () =>
          locator.count().then((count) =>
            Promise.all(
              Array.from(
                { length: count },
                (_, index) => locator.nth(index).innerText(withTimeout(options?.timeout))
              )
            )
          ),
        catch: (cause) => mapLocatorFailure("locator.allText", selector, cause)
      })
  })

const makePage = (page: Page): Effect.Effect<BrowserPage.BrowserPage> =>
  Effect.gen(function*() {
    const released = yield* Ref.make(false)

    const close = Effect.gen(function*() {
      const wasReleased = yield* Ref.getAndSet(released, true)
      if (wasReleased) {
        return
      }
      yield* Effect.tryPromise({
        try: () => page.close(),
        catch: (cause) => mapUnknown("page.close", cause)
      })
    })

    return BrowserPage.make({
      locator: (selector) => makeLocator(page.locator(selector), selector),
      goto: (url, options) => {
        const target = toTarget(url)
        return tryVoid({
          try: () => page.goto(target, toWaitUntilOptions(options)),
          catch: (cause) => mapNavigationFailure("page.goto", target, cause)
        })
      },
      reload: (options) =>
        tryVoid({
          try: () => page.reload(toWaitUntilOptions(options)),
          catch: (cause) => mapNavigationFailure("page.reload", page.url(), cause)
        }),
      goBack: (options) =>
        tryVoid({
          try: () => page.goBack(withTimeout(options?.timeout)),
          catch: (cause) => mapNavigationFailure("page.goBack", page.url(), cause)
        }),
      waitForURL: (url, options) => {
        const target = toTarget(url)
        return tryVoid({
          try: () => page.waitForURL(target, toWaitUntilOptions(options)),
          catch: (cause) => mapWaitForURLFailure(target, cause)
        })
      },
      waitForLoadState: (state, options) =>
        tryVoid({
          try: () =>
            (page.waitForLoadState as (
              state: BrowserPage.BrowserLoadState,
              options: { timeout: number }
            ) => Promise<void>)(state, {
              timeout: toDefaultTimeoutMs(options?.timeout)
            }),
          catch: mapWaitForLoadStateFailure
        }),
      title: Effect.tryPromise({
        try: () => page.title(),
        catch: (cause) => mapUnknown("page.title", cause)
      }),
      content: Effect.tryPromise({
        try: () => page.content(),
        catch: (cause) => mapUnknown("page.content", cause)
      }),
      evaluate: (pageFunction, arg) =>
        Effect.tryPromise({
          try: () => page.evaluate(pageFunction as never, arg as never),
          catch: (cause) => mapEvaluateCause(cause)
        }),
      screenshot: (options) =>
        Effect.tryPromise({
          try: () => page.screenshot(toScreenshotOptions(options)).then((buffer) => new Uint8Array(buffer)),
          catch: (cause) => mapUnknown("page.screenshot", cause)
        }),
      close
    })
  })

const makeContext = (
  context: PlaywrightBrowserContext,
  browser: PlaywrightBrowser
): Effect.Effect<BrowserContext.BrowserContext> =>
  Effect.gen(function*() {
    const released = yield* Ref.make(false)

    const close = Effect.gen(function*() {
      const wasReleased = yield* Ref.getAndSet(released, true)
      if (wasReleased) {
        return
      }
      yield* Effect.tryPromise({
        try: () => context.close(),
        catch: (cause) => mapUnknown("context.close", cause)
      })
      yield* Effect.tryPromise({
        try: () => browser.close(),
        catch: (cause) => mapUnknown("context.close", cause)
      })
    })

    return BrowserContext.make({
      newPage: Effect.gen(function*() {
        const page = yield* Effect.tryPromise({
          try: () => context.newPage(),
          catch: (cause) => mapLaunchFailure("context.newPage", cause)
        })
        const browserPage = yield* makePage(page)
        yield* Effect.addFinalizer(() => browserPage.close.pipe(Effect.ignore))
        return browserPage
      }),
      close
    })
  })

/**
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<BrowserDriver.BrowserDriver> = Layer.succeed(
  BrowserDriver.BrowserDriver,
  BrowserDriver.BrowserDriver.of({
    launch: Effect.fnUntraced(function*(options) {
      const browser = yield* Effect.tryPromise({
        try: () =>
          chromium.launch({
            headless: options?.headless ?? true
          }),
        catch: (cause) => mapLaunchFailure("browser.launch", cause)
      })

      const context = yield* Effect.tryPromise({
        try: () => browser.newContext(toContextOptions(options)),
        catch: (cause) => mapLaunchFailure("browser.launch", cause)
      })

      context.setDefaultTimeout(toDefaultTimeoutMs(options?.defaultTimeout))

      const browserContext = yield* makeContext(context, browser)
      yield* Effect.addFinalizer(() => browserContext.close.pipe(Effect.ignore))
      return browserContext
    })
  })
)
