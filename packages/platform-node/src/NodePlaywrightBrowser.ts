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

const withWaitForOptions = (
  options: BrowserLocator.WaitForOptions | undefined
): { timeout: number; state?: "attached" | "detached" | "visible" | "hidden" } => {
  const waitOptions: {
    timeout: number
    state?: "attached" | "detached" | "visible" | "hidden"
  } = {
    timeout: toDefaultTimeoutMs(options?.timeout)
  }
  if (options?.state !== undefined) {
    waitOptions.state = options.state
  }
  return waitOptions
}

const toExactOptions = (
  options: BrowserLocator.BrowserExactTextOptions | undefined
): { exact?: boolean } | undefined => options?.exact === true ? { exact: true } : undefined

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
    | BrowserPage.GoBackOptions
    | BrowserPage.WaitForURLOptions
    | undefined
): { timeout: number; waitUntil?: BrowserPage.BrowserNavigationWaitUntil } => {
  const waitOptions: {
    timeout: number
    waitUntil?: BrowserPage.BrowserNavigationWaitUntil
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

interface PlaywrightLocatorPrimitive extends BrowserLocator.BrowserLocatorPrimitive {
  readonly current: Locator
  readonly selector: string
}

const toPlaywrightLocatorPrimitive = (self: BrowserLocator.BrowserLocator): PlaywrightLocatorPrimitive =>
  BrowserLocator.toPrimitive(self) as PlaywrightLocatorPrimitive

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
    parts.push(`has: ${toPlaywrightLocatorPrimitive(options.has).selector}`)
  }
  if (options.hasNot !== undefined) {
    parts.push(`hasNot: ${toPlaywrightLocatorPrimitive(options.hasNot).selector}`)
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

const toFilterOptions = (
  options: BrowserLocator.BrowserLocatorFilterOptions
): {
  has?: Locator
  hasNot?: Locator
  hasText?: BrowserLocator.BrowserTextMatcher
  hasNotText?: BrowserLocator.BrowserTextMatcher
  visible?: boolean
} => {
  const filterOptions: {
    has?: Locator
    hasNot?: Locator
    hasText?: BrowserLocator.BrowserTextMatcher
    hasNotText?: BrowserLocator.BrowserTextMatcher
    visible?: boolean
  } = {}
  if (options.has !== undefined) {
    filterOptions.has = toPlaywrightLocatorPrimitive(options.has).current
  }
  if (options.hasNot !== undefined) {
    filterOptions.hasNot = toPlaywrightLocatorPrimitive(options.hasNot).current
  }
  if (options.hasText !== undefined) {
    filterOptions.hasText = options.hasText
  }
  if (options.hasNotText !== undefined) {
    filterOptions.hasNotText = options.hasNotText
  }
  if (options.visible !== undefined) {
    filterOptions.visible = options.visible
  }
  return filterOptions
}

const fromSelectorArg = (
  selector: string | BrowserLocator.BrowserLocator
): { readonly locator: string | Locator; readonly description: string } =>
  typeof selector === "string" ?
    { locator: selector, description: selector } :
    {
      locator: toPlaywrightLocatorPrimitive(selector).current,
      description: toPlaywrightLocatorPrimitive(selector).selector
    }

const runLocatorVoid = (
  selector: string,
  operation: BrowserError.BrowserElementError["browserOperation"],
  run: () => Promise<unknown>,
  reason?: BrowserError.BrowserElementError["reason"]
): Effect.Effect<void, BrowserError.BrowserError> =>
  tryVoid({
    try: run,
    catch: (cause) => mapLocatorFailure(operation, selector, cause, reason)
  })

const runLocatorEffect = <A>(
  selector: string,
  operation: BrowserError.BrowserElementError["browserOperation"],
  run: () => Promise<A>,
  reason?: BrowserError.BrowserElementError["reason"]
): Effect.Effect<A, BrowserError.BrowserError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => mapLocatorFailure(operation, selector, cause, reason)
  })

const makeLocatorRef = (current: Locator, selector: string): BrowserLocator.BrowserLocator =>
  BrowserLocator.make(makeLocatorPrimitive(current, selector))

function makeLocatorPrimitive(current: Locator, selector: string): PlaywrightLocatorPrimitive {
  return {
    current,
    selector,
    locator: (next) => {
      const resolved = fromSelectorArg(next)
      return makeLocatorRef(current.locator(resolved.locator), `${selector} >> ${resolved.description}`)
    },
    getByRole: (role, options) =>
      makeLocatorRef(
        current.getByRole(role as never, {
          ...(options?.name !== undefined ? { name: options.name } : undefined),
          ...(toExactOptions(options) ?? undefined)
        }),
        `${selector} >> role=${role}${describeRoleOptions(options)}`
      ),
    getByText: (text, options) =>
      makeLocatorRef(
        current.getByText(text, toExactOptions(options)),
        `${selector} >> text=${describeTextMatcher(text)}${describeExactOptions(options)}`
      ),
    getByLabel: (text, options) =>
      makeLocatorRef(
        current.getByLabel(text, toExactOptions(options)),
        `${selector} >> label=${describeTextMatcher(text)}${describeExactOptions(options)}`
      ),
    getByPlaceholder: (text, options) =>
      makeLocatorRef(
        current.getByPlaceholder(text, toExactOptions(options)),
        `${selector} >> placeholder=${describeTextMatcher(text)}${describeExactOptions(options)}`
      ),
    getByAltText: (text, options) =>
      makeLocatorRef(
        current.getByAltText(text, toExactOptions(options)),
        `${selector} >> alt=${describeTextMatcher(text)}${describeExactOptions(options)}`
      ),
    getByTitle: (text, options) =>
      makeLocatorRef(
        current.getByTitle(text, toExactOptions(options)),
        `${selector} >> title=${describeTextMatcher(text)}${describeExactOptions(options)}`
      ),
    getByTestId: (testId) =>
      makeLocatorRef(
        current.getByTestId(testId as never),
        `${selector} >> testId=${describeTextMatcher(testId)}`
      ),
    filter: (options) =>
      makeLocatorRef(
        current.filter(toFilterOptions(options)),
        `${selector} >> filter(${describeFilterOptions(options)})`
      ),
    and: (that) => {
      const other = toPlaywrightLocatorPrimitive(that)
      return makeLocatorRef(current.and(other.current), `${selector} && ${other.selector}`)
    },
    or: (that) => {
      const other = toPlaywrightLocatorPrimitive(that)
      return makeLocatorRef(current.or(other.current), `${selector} || ${other.selector}`)
    },
    first: () => makeLocatorRef(current.first(), `${selector} >> first()`),
    last: () => makeLocatorRef(current.last(), `${selector} >> last()`),
    nth: (index) => makeLocatorRef(current.nth(index), `${selector} >> nth(${String(index)})`),
    click: (options) =>
      runLocatorVoid(selector, "locator.click", () => current.click(withTimeout(options?.timeout))),
    fill: (value, options) =>
      Effect.gen(function*() {
        const timeout = toDefaultTimeoutMs(options?.timeout)
        if (options?.clear === true) {
          yield* Effect.tryPromise({
            try: () => current.clear({ timeout }),
            catch: (cause) => mapLocatorFailure("locator.fill", selector, cause, "notActionable")
          })
        }
        yield* Effect.tryPromise({
          try: () => current.fill(value, { timeout }),
          catch: (cause) => mapLocatorFailure("locator.fill", selector, cause)
        })
        return undefined
      }),
    press: (key, options) =>
      runLocatorVoid(selector, "locator.press", () => current.press(key, toPressOptions(options))),
    hover: (options) =>
      runLocatorVoid(selector, "locator.hover", () => current.hover(withTimeout(options?.timeout))),
    scrollIntoViewIfNeeded: (options) =>
      runLocatorVoid(
        selector,
        "locator.scrollIntoViewIfNeeded",
        () => current.scrollIntoViewIfNeeded(withTimeout(options?.timeout))
      ),
    waitFor: (options) =>
      runLocatorVoid(
        selector,
        "locator.waitFor",
        () => current.waitFor(withWaitForOptions(options)),
        "notFound"
      ),
    textContent: (options) =>
      runLocatorEffect(
        selector,
        "locator.text",
        () => current.textContent(withTimeout(options?.timeout)).then((value) => value ?? "")
      ),
    innerText: (options) =>
      runLocatorEffect(selector, "locator.innerText", () => current.innerText(withTimeout(options?.timeout))),
    attribute: (name, options) =>
      runLocatorEffect(
        selector,
        "locator.attribute",
        () => current.getAttribute(name, withTimeout(options?.timeout))
      ),
    count: runLocatorEffect(selector, "locator.count", () => current.count()),
    allTextContents: (options) =>
      runLocatorEffect(selector, "locator.allText", () =>
        current.count().then((count) =>
          Promise.all(
            Array.from(
              { length: count },
              (_, index) => current.nth(index).textContent(withTimeout(options?.timeout)).then((value) => value ?? "")
            )
          )
        ))
  }
}

const makePageLocator = (page: Page, selector: string | BrowserLocator.BrowserLocator): BrowserLocator.BrowserLocator => {
  const resolved = fromSelectorArg(selector)
  return makeLocatorRef(page.locator(resolved.locator as never), resolved.description)
}

const getByRole = (page: Page, role: string, options?: BrowserLocator.GetByRoleOptions | undefined) =>
  makeLocatorRef(page.getByRole(role as never, {
    ...(options?.name !== undefined ? { name: options.name } : undefined),
    ...(toExactOptions(options) ?? undefined)
  }), `role=${role}${describeRoleOptions(options)}`)

const getByText = (page: Page, text: BrowserLocator.BrowserTextMatcher, options?: BrowserLocator.BrowserExactTextOptions) =>
  makeLocatorRef(page.getByText(text, toExactOptions(options)), `text=${describeTextMatcher(text)}${describeExactOptions(options)}`)

const getByLabel = (page: Page, text: BrowserLocator.BrowserTextMatcher, options?: BrowserLocator.BrowserExactTextOptions) =>
  makeLocatorRef(page.getByLabel(text, toExactOptions(options)), `label=${describeTextMatcher(text)}${describeExactOptions(options)}`)

const getByPlaceholder = (
  page: Page,
  text: BrowserLocator.BrowserTextMatcher,
  options?: BrowserLocator.BrowserExactTextOptions
) =>
  makeLocatorRef(
    page.getByPlaceholder(text, toExactOptions(options)),
    `placeholder=${describeTextMatcher(text)}${describeExactOptions(options)}`
  )

const getByAltText = (page: Page, text: BrowserLocator.BrowserTextMatcher, options?: BrowserLocator.BrowserExactTextOptions) =>
  makeLocatorRef(page.getByAltText(text, toExactOptions(options)), `alt=${describeTextMatcher(text)}${describeExactOptions(options)}`)

const getByTitle = (page: Page, text: BrowserLocator.BrowserTextMatcher, options?: BrowserLocator.BrowserExactTextOptions) =>
  makeLocatorRef(page.getByTitle(text, toExactOptions(options)), `title=${describeTextMatcher(text)}${describeExactOptions(options)}`)

const getByTestId = (page: Page, testId: BrowserLocator.BrowserTextMatcher) =>
  makeLocatorRef(page.getByTestId(testId as never), `testId=${describeTextMatcher(testId)}`)

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
      locator: (selector) => makePageLocator(page, selector),
      getByRole: (role, options) => getByRole(page, role, options),
      getByText: (text, options) => getByText(page, text, options),
      getByLabel: (text, options) => getByLabel(page, text, options),
      getByPlaceholder: (text, options) => getByPlaceholder(page, text, options),
      getByAltText: (text, options) => getByAltText(page, text, options),
      getByTitle: (text, options) => getByTitle(page, text, options),
      getByTestId: (testId) => getByTestId(page, testId),
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
          try: () => page.goBack(toWaitUntilOptions(options)),
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
          try: () => page.waitForLoadState(state, { timeout: toDefaultTimeoutMs(options?.timeout) }),
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
