/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import type * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type * as Scope from "../../Scope.ts"
import type * as BrowserContext from "./BrowserContext.ts"
import type * as BrowserError from "./BrowserError.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserLaunchOptions {
  readonly headless?: boolean | undefined
  readonly viewport?: {
    readonly width: number
    readonly height: number
  } | undefined
  readonly defaultTimeout?: Duration.Input | undefined
  readonly userAgent?: string | undefined
  readonly locale?: string | undefined
}

/**
 * @since 4.0.0
 * @category models
 */
export interface BrowserDriverService {
  readonly launch: (
    options?: BrowserLaunchOptions | undefined
  ) => Effect.Effect<BrowserContext.BrowserContext, BrowserError.BrowserError, Scope.Scope>
}

/**
 * Wraps `launch` with middleware over the context acquisition effect.
 *
 * @since 4.0.0
 * @category combinators
 */
export const transform: {
  <E1, R1>(
    f: (
      effect: Effect.Effect<BrowserContext.BrowserContext, BrowserError.BrowserError, Scope.Scope>,
      options: BrowserLaunchOptions | undefined
    ) => Effect.Effect<
      BrowserContext.BrowserContext,
      BrowserError.BrowserError | E1,
      Scope.Scope | R1
    >
  ): (self: BrowserDriverService) => BrowserDriverService
  <E1, R1>(
    self: BrowserDriverService,
    f: (
      effect: Effect.Effect<BrowserContext.BrowserContext, BrowserError.BrowserError, Scope.Scope>,
      options: BrowserLaunchOptions | undefined
    ) => Effect.Effect<
      BrowserContext.BrowserContext,
      BrowserError.BrowserError | E1,
      Scope.Scope | R1
    >
  ): BrowserDriverService
} = dual(
  2,
  <E1, R1>(
    self: BrowserDriverService,
    f: (
      effect: Effect.Effect<BrowserContext.BrowserContext, BrowserError.BrowserError, Scope.Scope>,
      options: BrowserLaunchOptions | undefined
    ) => Effect.Effect<
      BrowserContext.BrowserContext,
      BrowserError.BrowserError | E1,
      Scope.Scope | R1
    >
  ): BrowserDriverService =>
    ({
      // Middleware may widen `E` / `R`; callers rely on `as BrowserDriverService` for the fixed service shape.
      // @effect-diagnostics-next-line missingEffectContext:off
      // @effect-diagnostics-next-line missingEffectError:off
      launch: (options) => f(self.launch(options), options)
    }) as BrowserDriverService
)

/**
 * Runs `tap` before `launch` for logging, metrics, or tracing.
 *
 * @since 4.0.0
 * @category combinators
 */
export const tapLaunch: {
  <E1, R1>(
    tap: (options: BrowserLaunchOptions | undefined) => Effect.Effect<void, E1, R1>
  ): (self: BrowserDriverService) => BrowserDriverService
  <E1, R1>(
    self: BrowserDriverService,
    tap: (options: BrowserLaunchOptions | undefined) => Effect.Effect<void, E1, R1>
  ): BrowserDriverService
} = dual(
  2,
  <E1, R1>(
    self: BrowserDriverService,
    tap: (options: BrowserLaunchOptions | undefined) => Effect.Effect<void, E1, R1>
  ): BrowserDriverService =>
    ({
      // @effect-diagnostics-next-line missingEffectContext:off
      // @effect-diagnostics-next-line missingEffectError:off
      launch: (options) =>
        tap(options).pipe(
          Effect.andThen(self.launch(options))
        )
    }) as BrowserDriverService
)

/**
 * Service tag for browser automation drivers (e.g. Playwright on Node).
 *
 * @since 4.0.0
 * @category services
 */
export class BrowserDriver extends Context.Service<BrowserDriver, BrowserDriverService>()(
  "effect/unstable/browser/BrowserDriver"
) {}
