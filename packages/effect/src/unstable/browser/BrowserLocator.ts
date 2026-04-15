/**
 * @since 4.0.0
 */
import type * as Duration from "../../Duration.ts"
import type * as Effect from "../../Effect.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import type { Pipeable } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import type * as BrowserError from "./BrowserError.ts"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId = "~effect/browser/BrowserLocator"

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserLocator = (u: unknown): u is BrowserLocator => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface LocatorTimeoutOptions {
  readonly timeout?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface ClickOptions extends LocatorTimeoutOptions {}

/**
 * @since 4.0.0
 * @category models
 */
export interface FillOptions extends LocatorTimeoutOptions {
  readonly clear?: boolean | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface PressOptions extends LocatorTimeoutOptions {
  readonly delay?: Duration.Input | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface WaitForOptions extends LocatorTimeoutOptions {}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserLocator extends Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly locator: (selector: string) => BrowserLocator

  readonly nth: (index: number) => BrowserLocator

  readonly click: (options?: ClickOptions | undefined) => Effect.Effect<void, BrowserError.BrowserError>

  readonly fill: (
    value: string,
    options?: FillOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly press: (
    key: string,
    options?: PressOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly hover: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<void, BrowserError.BrowserError>

  readonly scrollIntoViewIfNeeded: (
    options?: LocatorTimeoutOptions | undefined
  ) => Effect.Effect<void, BrowserError.BrowserError>

  readonly waitFor: (options?: WaitForOptions | undefined) => Effect.Effect<void, BrowserError.BrowserError>

  readonly text: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<string, BrowserError.BrowserError>

  readonly innerText: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<string, BrowserError.BrowserError>

  readonly attribute: (
    name: string,
    options?: LocatorTimeoutOptions | undefined
  ) => Effect.Effect<string | null, BrowserError.BrowserError>

  readonly count: Effect.Effect<number, BrowserError.BrowserError>

  readonly allText: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<
    ReadonlyArray<string>,
    BrowserError.BrowserError
  >
}

const Proto = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON(this: BrowserLocator) {
    return { _id: "BrowserLocator" }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (locator: Omit<BrowserLocator, typeof TypeId | "pipe">): BrowserLocator =>
  Object.assign(Object.create(Proto), locator)
