/**
 * User-facing accessors and scoped helpers for {@link BrowserDriver}.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type * as Scope from "../../Scope.ts"
import * as BrowserContext from "./BrowserContext.ts"
import { BrowserDriver, type BrowserDriverService } from "./BrowserDriver.ts"
import type * as BrowserDriverTypes from "./BrowserDriver.ts"
import type * as BrowserError from "./BrowserError.ts"
import type * as BrowserPage from "./BrowserPage.ts"

/**
 * @since 4.0.0
 * @category constructors
 */
export const launch: (
  options?: BrowserDriverTypes.BrowserLaunchOptions | undefined
) => Effect.Effect<
  BrowserContext.BrowserContext,
  BrowserError.BrowserError,
  BrowserDriver | Scope.Scope
> = (options) => BrowserDriver.use((driver: BrowserDriverService) => driver.launch(options))

/**
 * Runs `body` with a browser context acquired from {@link BrowserDriver} and
 * closed when the inner scope ends.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withContext: {
  <A, E, R>(
    body: (context: BrowserContext.BrowserContext) => Effect.Effect<A, E, R>
  ): (
    options?: BrowserDriverTypes.BrowserLaunchOptions | undefined
  ) => Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope>
  <A, E, R>(
    options: BrowserDriverTypes.BrowserLaunchOptions | undefined,
    body: (context: BrowserContext.BrowserContext) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope>
} = dual(
  2,
  <A, E, R>(
    options: BrowserDriverTypes.BrowserLaunchOptions | undefined,
    body: (context: BrowserContext.BrowserContext) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope> =>
    Effect.scoped(
      Effect.flatMap(BrowserDriver.asEffect(), (driver) => Effect.flatMap(driver.launch(options), body))
    )
)

/**
 * Launches a browser context, opens one page, runs `body`, then tears down
 * the page and context.
 *
 * @since 4.0.0
 * @category combinators
 */
export const withPage: {
  <A, E, R>(
    body: (page: BrowserPage.BrowserPage) => Effect.Effect<A, E, R>
  ): (
    options?: BrowserDriverTypes.BrowserLaunchOptions | undefined
  ) => Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope>
  <A, E, R>(
    options: BrowserDriverTypes.BrowserLaunchOptions | undefined,
    body: (page: BrowserPage.BrowserPage) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope>
} = dual(
  2,
  <A, E, R>(
    options: BrowserDriverTypes.BrowserLaunchOptions | undefined,
    body: (page: BrowserPage.BrowserPage) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | BrowserError.BrowserError, R | BrowserDriver | Scope.Scope> =>
    withContext(options, (context) => BrowserContext.withPage(context, body))
)
