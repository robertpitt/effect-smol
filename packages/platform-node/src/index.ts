/**
 * @since 1.0.0
 */

// @barrel: Auto-generated exports. Do not edit manually.

/**
 * @since 1.0.0
 */
export * as Mime from "./Mime.ts"

/**
 * Node.js implementation of `ChildProcessSpawner`.
 *
 * @since 1.0.0
 */
export * as NodeChildProcessSpawner from "./NodeChildProcessSpawner.ts"

/**
 * @since 1.0.0
 */
export * as NodeClusterHttp from "./NodeClusterHttp.ts"

/**
 * @since 1.0.0
 */
export * as NodeClusterSocket from "./NodeClusterSocket.ts"

/**
 * @since 1.0.0
 */
export * as NodeFileSystem from "./NodeFileSystem.ts"

/**
 * @since 1.0.0
 */
export * as NodeHttpClient from "./NodeHttpClient.ts"

/**
 * @since 1.0.0
 */
export * as NodeHttpIncomingMessage from "./NodeHttpIncomingMessage.ts"

/**
 * @since 1.0.0
 */
export * as NodeHttpPlatform from "./NodeHttpPlatform.ts"

/**
 * @since 1.0.0
 */
export * as NodeHttpServer from "./NodeHttpServer.ts"

/**
 * @since 1.0.0
 */
export * as NodeHttpServerRequest from "./NodeHttpServerRequest.ts"

/**
 * @since 1.0.0
 */
export * as NodeMultipart from "./NodeMultipart.ts"

/**
 * @since 1.0.0
 */
export * as NodePath from "./NodePath.ts"

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
export * as NodePlaywrightBrowser from "./NodePlaywrightBrowser.ts"

/**
 * @since 1.0.0
 */
export * as NodeRedis from "./NodeRedis.ts"

/**
 * @since 1.0.0
 */
export * as NodeRuntime from "./NodeRuntime.ts"

/**
 * @since 1.0.0
 */
export * as NodeServices from "./NodeServices.ts"

/**
 * @since 1.0.0
 */
export * as NodeSink from "./NodeSink.ts"

/**
 * @since 1.0.0
 */
export * as NodeSocket from "./NodeSocket.ts"

/**
 * @since 1.0.0
 */
export * as NodeSocketServer from "./NodeSocketServer.ts"

/**
 * @since 1.0.0
 */
export * as NodeStdio from "./NodeStdio.ts"

/**
 * @since 1.0.0
 */
export * as NodeStream from "./NodeStream.ts"

/**
 * @since 1.0.0
 */
export * as NodeTerminal from "./NodeTerminal.ts"

/**
 * @since 1.0.0
 */
export * as NodeWorker from "./NodeWorker.ts"

/**
 * @since 1.0.0
 */
export * as NodeWorkerRunner from "./NodeWorkerRunner.ts"

/**
 * @since 1.0.0
 */
export * as Undici from "./Undici.ts"
