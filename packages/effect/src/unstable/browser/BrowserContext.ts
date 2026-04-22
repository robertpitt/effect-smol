/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import { PipeInspectableProto } from "../../internal/core.ts"
import type { Pipeable } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import type * as Scope from "../../Scope.ts"
import type * as BrowserError from "./BrowserError.ts"
import type { BrowserPage } from "./BrowserPage.ts"

/**
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId = "~effect/browser/BrowserContext"

/**
 * @since 4.0.0
 * @category guards
 */
export const isBrowserContext = (u: unknown): u is BrowserContext => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserContext extends Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly newPage: Effect.Effect<BrowserPage, BrowserError.BrowserError, Scope.Scope>

  readonly close: Effect.Effect<void, BrowserError.BrowserError>
}

const Proto = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON(this: BrowserContext) {
    return { _id: "BrowserContext" }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (context: Omit<BrowserContext, typeof TypeId | "pipe">): BrowserContext =>
  Object.assign(Object.create(Proto), context)

/**
 * Runs `body` with a page acquired from `newPage`, closing the page when the
 * inner scope ends.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPage: {
  <A, E, R>(
    body: (page: BrowserPage) => Effect.Effect<A, E, R>
  ): (self: BrowserContext) => Effect.Effect<A, E | BrowserError.BrowserError, R>
  <A, E, R>(
    self: BrowserContext,
    body: (page: BrowserPage) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R>
} = dual(
  2,
  <A, E, R>(
    self: BrowserContext,
    body: (page: BrowserPage) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R> =>
    Effect.scoped(
      Effect.flatMap(self.newPage, body)
    )
)
