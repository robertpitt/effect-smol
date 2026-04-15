import { NodePlaywrightBrowser } from "@effect/platform-node"
import { Effect } from "effect"
import { Browser } from "effect/unstable/browser"

const workflow = Browser.withPage({ headless: false }, (page) =>
  Effect.gen(function*() {
    yield* page.goto("https://www.google.com/maps")
    yield* page.waitForLoadState("domcontentloaded")
    const rejectCookies = page.locator(
      "button:has-text('Reject all'), button:has-text('Reject All'), button[aria-label='Reject all'], button[aria-label='Reject All']"
    ).nth(0)

    const searchInput = page.locator("input[name='q']")
    const searchButton = page.locator("button[aria-label='Search']")
    const results = page.locator("div[role='feed']").locator("a[href*='/maps/place/']")
    const details = page.locator(".tTVLSc:nth-child(3)")

    // // Card Header
    // const placeName = details.locator("div[role='main'][aria-label] .lfPIob")

    // // Tabs
    // const overViewTab = details.locator("div[role='tablist'] button:has-text('Overview')")
    // const menuTab = details.locator("div[role='tablist'] button:has-text('Menu')")
    // const reviewsTab = details.locator("div[role='tablist'] button:has-text('Reviews')")
    // const aboutTab = details.locator("div[role='tablist'] button:has-text('About')")

    // // address is finding span with google-symbols PHazN, going one level up, then going to the next sibling and first div within that sibling
    // const address = details.locator("button[aria-label^='Address:'] > span")

    const cookieBannerPresent = yield* rejectCookies.count
    if (cookieBannerPresent > 0) {
      yield* rejectCookies.click()
    }

    yield* searchInput.waitFor()
    yield* searchInput.fill("Takeaways in Manchester")
    yield* searchButton.click()
    yield* results.nth(0).waitFor()

    let totalResults = yield* results.count
    for (let index = 0; index < totalResults; index++) {
      yield* results.nth(index).click()
      yield* Effect.sleep("1 seconds")

      // Wait for the details page to load
      yield* details.waitFor()

      // Find the details
      const name = yield* details.locator(".DUwDvf").text()
      const rating = yield* details.locator(".skqShb span").text()
      console.log(name, rating)

      
      /**
       * Yeild the details
      */
      // console.log({
      //   placeName: yield* placeName.text(),
      //   address: yield* address.text(),
      //   overViewTab: yield* overViewTab.count,
      //   menuTab: yield* menuTab.count,
      //   reviewsTab: yield* reviewsTab.count,
      //   aboutTab: yield* aboutTab.count,
      // })
      
      // // Fetch the address from the details page
      // console.log(yield* address.text())
      // const addressText = yield* address.text()
      // console.log(addressText)

      // Update the counter for autoloaded results
      totalResults = yield* results.count
    }
  }))

Effect.runPromise(workflow.pipe(
  Effect.scoped,
  Effect.provide(NodePlaywrightBrowser.layer)
))
