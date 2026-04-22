/**
 * @since 4.0.0
 */
import type * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import type { Pipeable } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import type { Top } from "../../Schema.ts"
import type * as BrowserError from "./BrowserError.ts"
import type * as BrowserLocator from "./BrowserLocator.ts"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId = "~effect/browser/BrowserPage"

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserPage = (u: unknown): u is BrowserPage => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export type BrowserNavigationWaitUntil = "load" | "domcontentloaded" | "networkidle" | "commit"

/**
 * @since 4.0.0
 * @category models
 */
export type BrowserLoadState = "load" | "domcontentloaded" | "networkidle"

/**
 * @since 4.0.0
 * @category models
 */
export interface GotoOptions {
  readonly waitUntil?: BrowserNavigationWaitUntil | undefined
  readonly timeout?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface ReloadOptions {
  readonly waitUntil?: BrowserNavigationWaitUntil | undefined
  readonly timeout?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface GoBackOptions {
  readonly waitUntil?: BrowserNavigationWaitUntil | undefined
  readonly timeout?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface WaitForURLOptions {
  readonly timeout?: Duration.Input | undefined
  readonly waitUntil?: BrowserNavigationWaitUntil | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface WaitForLoadStateOptions {
  readonly timeout?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface ScreenshotOptions {
  readonly fullPage?: boolean | undefined
  readonly type?: "png" | "jpeg" | undefined
  readonly quality?: number | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserPage extends Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly locator: (selector: string | BrowserLocator.BrowserLocator) => BrowserLocator.BrowserLocator

  readonly getByRole: (
    role: string,
    options?: BrowserLocator.GetByRoleOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByText: (
    text: BrowserLocator.BrowserTextMatcher,
    options?: BrowserLocator.BrowserExactTextOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByLabel: (
    text: BrowserLocator.BrowserTextMatcher,
    options?: BrowserLocator.BrowserExactTextOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByPlaceholder: (
    text: BrowserLocator.BrowserTextMatcher,
    options?: BrowserLocator.BrowserExactTextOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByAltText: (
    text: BrowserLocator.BrowserTextMatcher,
    options?: BrowserLocator.BrowserExactTextOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByTitle: (
    text: BrowserLocator.BrowserTextMatcher,
    options?: BrowserLocator.BrowserExactTextOptions | undefined
  ) => BrowserLocator.BrowserLocator

  readonly getByTestId: (testId: BrowserLocator.BrowserTextMatcher) => BrowserLocator.BrowserLocator

  readonly goto: (
    url: string | URL,
    options?: GotoOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly reload: (options?: ReloadOptions | undefined) => Effect.Effect<void, BrowserError.BrowserError>

  readonly goBack: (options?: GoBackOptions | undefined) => Effect.Effect<void, BrowserError.BrowserError>

  readonly waitForURL: (
    url: string | URL,
    options?: WaitForURLOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly waitForLoadState: (
    state: BrowserLoadState,
    options?: WaitForLoadStateOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly title: Effect.Effect<string, BrowserError.BrowserError>

  readonly content: Effect.Effect<string, BrowserError.BrowserError>

  readonly evaluate: (
    pageFunction: string | ((arg: unknown) => unknown),
    arg?: unknown
  ) => Effect.Effect<unknown, BrowserError.BrowserError>

  readonly screenshot: (
    options?: ScreenshotOptions | undefined
  ) => Effect.Effect<Uint8Array, BrowserError.BrowserError>

  readonly close: Effect.Effect<void, BrowserError.BrowserError>
}

const Proto = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON(this: BrowserPage) {
    return { _id: "BrowserPage" }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (page: Omit<BrowserPage, typeof TypeId | "pipe">): BrowserPage =>
  Object.assign(Object.create(Proto), page)

/**
 * Runs `evaluate` and decodes the result with `Schema`.
 *
 * @since 4.0.0
 * @category schema
 */
export const evaluateSchema = <S extends Top>(
  self: BrowserPage,
  schema: S,
  pageFunction: string | ((arg: unknown) => unknown),
  arg?: unknown
): Effect.Effect<
  S["Type"],
  BrowserError.BrowserError | Schema.SchemaError,
  S["DecodingServices"]
> =>
  Effect.flatMap(
    self.evaluate(pageFunction, arg),
    Schema.decodeUnknownEffect(schema)
  )
