import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as NodePlaywrightBrowser from "@effect/platform-node/NodePlaywrightBrowser"
import * as WorkflowEngine from "effect/unstable/workflow/WorkflowEngine"
import * as BrowserWorkflowRuntime from "./BrowserWorkflowRuntime.ts"
import { GoogleMapsWorkflow, GoogleMapsWorkflowLayer } from "./GoogleMapsWorkflow.ts"

const layer = GoogleMapsWorkflowLayer.pipe(
  Layer.provideMerge(WorkflowEngine.layerMemory),
  Layer.provideMerge(BrowserWorkflowRuntime.layer({ headless: false })),
  Layer.provideMerge(NodePlaywrightBrowser.layer)
)

const createSearchWorkflow = (query: string) => GoogleMapsWorkflow.execute({
  query,
  maxResults: 15
})

const workflow = Effect.all([
  createSearchWorkflow("Takeaways in Manchester"),
  createSearchWorkflow("Takeaways in Walsall"),
  createSearchWorkflow("Takeaways in Wolverhampton"),
], { concurrency: "unbounded" })
  .pipe(Effect.provide(layer)).pipe(
    Effect.flatMap((results) => Effect.sync(() => {
      console.log(JSON.stringify(results, null, 2))
    }))
  )

Effect.runPromiseExit(workflow).then((exit) => {
  if (Exit.isFailure(exit)) {
    console.error(JSON.stringify(exit.cause, null, 2))
    process.exitCode = 1
  }
})
