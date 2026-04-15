/**
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts"
import * as Data from "../../Data.ts"
import * as Predicate from "../../Predicate.ts"

/**
 * Normalized operation name for logging, tracing, and `catchTags` ergonomics.
 *
 * @since 4.0.0
 * @category models
 */
export type BrowserOperation =
  | "browser.launch"
  | "context.newPage"
  | "context.close"
  | "page.goto"
  | "page.reload"
  | "page.goBack"
  | "page.waitForURL"
  | "page.waitForLoadState"
  | "page.close"
  | "page.title"
  | "page.content"
  | "page.evaluate"
  | "page.screenshot"
  | "locator.waitFor"
  | "locator.click"
  | "locator.fill"
  | "locator.press"
  | "locator.hover"
  | "locator.scrollIntoViewIfNeeded"
  | "locator.text"
  | "locator.innerText"
  | "locator.attribute"
  | "locator.count"
  | "locator.allText"
  | string

const browserErrorTags = new Set([
  "BrowserLaunchError",
  "BrowserTimeoutError",
  "BrowserClosedError",
  "BrowserNavigationError",
  "BrowserElementError",
  "BrowserEvaluateError",
  "BrowserUnknownError"
])

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserError = (u: unknown): u is BrowserError =>
  typeof u === "object" &&
  u !== null &&
  Predicate.hasProperty(u, "_tag") &&
  Predicate.isString(u["_tag"]) &&
  browserErrorTags.has(u["_tag"])

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserLaunchError = (u: unknown): u is BrowserLaunchError => Predicate.isTagged(u, "BrowserLaunchError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserTimeoutError = (u: unknown): u is BrowserTimeoutError =>
  Predicate.isTagged(u, "BrowserTimeoutError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserClosedError = (u: unknown): u is BrowserClosedError => Predicate.isTagged(u, "BrowserClosedError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserNavigationError = (u: unknown): u is BrowserNavigationError =>
  Predicate.isTagged(u, "BrowserNavigationError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserElementError = (u: unknown): u is BrowserElementError =>
  Predicate.isTagged(u, "BrowserElementError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserUnknownError = (u: unknown): u is BrowserUnknownError =>
  Predicate.isTagged(u, "BrowserUnknownError")

/**
 * @since 4.0.0
 * @category errors
 */
export class BrowserLaunchError extends Data.TaggedError("BrowserLaunchError")<{
  readonly browserOperation: BrowserOperation
  readonly description?: string | undefined
  readonly cause?: unknown
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class BrowserTimeoutError extends Data.TaggedError("BrowserTimeoutError")<{
  readonly browserOperation: BrowserOperation
  readonly description?: string | undefined
  readonly selector?: string | undefined
  readonly url?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class BrowserClosedError extends Data.TaggedError("BrowserClosedError")<{
  readonly browserOperation: BrowserOperation
  readonly description?: string | undefined
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class BrowserNavigationError extends Data.TaggedError("BrowserNavigationError")<{
  readonly browserOperation: "page.goto" | "page.reload" | "page.goBack" | "page.waitForURL"
  readonly url: string
  readonly description?: string | undefined
  readonly cause?: unknown
}> {}

/**
 * DOM element not found or not actionable (replaces separate selector vs interaction errors).
 *
 * @since 4.0.0
 * @category errors
 */
export class BrowserElementError extends Data.TaggedError("BrowserElementError")<{
  readonly browserOperation:
    | "locator.waitFor"
    | "locator.click"
    | "locator.fill"
    | "locator.press"
    | "locator.hover"
    | "locator.scrollIntoViewIfNeeded"
    | "locator.text"
    | "locator.innerText"
    | "locator.attribute"
    | "locator.count"
    | "locator.allText"
  readonly selector: string
  readonly reason: "notFound" | "notActionable" | "other"
  readonly description?: string | undefined
  readonly cause?: unknown
}> {}

/**
 * @since 4.0.0
 * @category errors
 */
export class BrowserUnknownError extends Data.TaggedError("BrowserUnknownError")<{
  readonly browserOperation: BrowserOperation
  readonly description?: string | undefined
  readonly selector?: string | undefined
  readonly url?: string | undefined
  readonly cause?: unknown
  /** When the driver surfaced a structured defect, it is preserved here. */
  readonly defect?: Cause.Cause<never> | undefined
}> {}

/**
 * In-page script failed to parse or threw before returning (e.g. malformed
 * `evaluate` string, `ReferenceError` in the browser context).
 *
 * @since 4.0.0
 * @category errors
 */
export class BrowserEvaluateError extends Data.TaggedError("BrowserEvaluateError")<{
  readonly browserOperation: "page.evaluate"
  readonly kind: "parse" | "runtime" | "other"
  readonly description?: string | undefined
  readonly cause?: unknown
}> {}

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserEvaluateError = (u: unknown): u is BrowserEvaluateError =>
  Predicate.isTagged(u, "BrowserEvaluateError")

/**
 * @since 4.0.0
 * @category guards
 */
export const isRetryableDomError = (u: unknown): u is BrowserElementError | BrowserTimeoutError =>
  isBrowserElementError(u) ?
    u.reason === "notFound" || u.reason === "notActionable" :
    isBrowserTimeoutError(u) && u.selector !== undefined

/**
 * @since 4.0.0
 * @category errors
 */
export type BrowserError =
  | BrowserLaunchError
  | BrowserTimeoutError
  | BrowserClosedError
  | BrowserNavigationError
  | BrowserElementError
  | BrowserEvaluateError
  | BrowserUnknownError
