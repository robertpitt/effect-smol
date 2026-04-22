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
 * @category Type IDs
 */
export const PrimitiveId: unique symbol = Symbol.for("effect/browser/BrowserLocator/Primitive") as never

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserLocator = (u: unknown): u is BrowserLocator => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export type BrowserTextMatcher = string | RegExp

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserExactTextOptions {
  readonly exact?: boolean | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface GetByRoleOptions extends BrowserExactTextOptions {
  readonly name?: BrowserTextMatcher | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserLocatorFilterOptions {
  readonly has?: BrowserLocator | undefined
  readonly hasNot?: BrowserLocator | undefined
  readonly hasText?: BrowserTextMatcher | undefined
  readonly hasNotText?: BrowserTextMatcher | undefined
  readonly visible?: boolean | undefined
}

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
export interface WaitForOptions extends LocatorTimeoutOptions {
  readonly state?: "attached" | "detached" | "visible" | "hidden" | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserLocatorPrimitive {
  readonly locator: (selector: string | BrowserLocator) => BrowserLocator
  readonly getByRole: (role: string, options?: GetByRoleOptions | undefined) => BrowserLocator
  readonly getByText: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByLabel: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByPlaceholder: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByAltText: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByTitle: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByTestId: (testId: BrowserTextMatcher) => BrowserLocator
  readonly filter: (options: BrowserLocatorFilterOptions) => BrowserLocator
  readonly and: (locator: BrowserLocator) => BrowserLocator
  readonly or: (locator: BrowserLocator) => BrowserLocator
  readonly first: () => BrowserLocator
  readonly last: () => BrowserLocator
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
  readonly textContent: (
    options?: LocatorTimeoutOptions | undefined
  ) => Effect.Effect<string, BrowserError.BrowserError>
  readonly innerText: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<string, BrowserError.BrowserError>
  readonly attribute: (
    name: string,
    options?: LocatorTimeoutOptions | undefined
  ) => Effect.Effect<string | null, BrowserError.BrowserError>
  readonly count: Effect.Effect<number, BrowserError.BrowserError>
  readonly allTextContents: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<
    ReadonlyArray<string>,
    BrowserError.BrowserError
  >
}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserLocator extends Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly [PrimitiveId]: BrowserLocatorPrimitive

  readonly locator: (selector: string | BrowserLocator) => BrowserLocator
  readonly getByRole: (role: string, options?: GetByRoleOptions | undefined) => BrowserLocator
  readonly getByText: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByLabel: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByPlaceholder: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByAltText: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByTitle: (text: BrowserTextMatcher, options?: BrowserExactTextOptions | undefined) => BrowserLocator
  readonly getByTestId: (testId: BrowserTextMatcher) => BrowserLocator
  readonly filter: (options: BrowserLocatorFilterOptions) => BrowserLocator
  readonly and: (locator: BrowserLocator) => BrowserLocator
  readonly or: (locator: BrowserLocator) => BrowserLocator
  readonly first: () => BrowserLocator
  readonly last: () => BrowserLocator
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

  readonly textContent: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<string, BrowserError.BrowserError>

  readonly innerText: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<string, BrowserError.BrowserError>

  readonly attribute: (
    name: string,
    options?: LocatorTimeoutOptions | undefined
  ) => Effect.Effect<string | null, BrowserError.BrowserError>

  readonly count: Effect.Effect<number, BrowserError.BrowserError>

  readonly allTextContents: (options?: LocatorTimeoutOptions | undefined) => Effect.Effect<
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
 * @category getters
 */
export const toPrimitive = (self: BrowserLocator): BrowserLocatorPrimitive => self[PrimitiveId]

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (primitive: BrowserLocatorPrimitive): BrowserLocator =>
  Object.assign(Object.create(Proto), {
    [PrimitiveId]: primitive,
    ...primitive
  })
