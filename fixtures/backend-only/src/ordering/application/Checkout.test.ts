import { assert, it } from "@effect/vitest"
import { vi } from "vitest"

const release = vi.fn()
vi.mock("./OrderStore")
vi.spyOn(globalThis, "setTimeout")
vi.stubGlobal("fetch", release)
vi.useFakeTimers()

it("counts an assert from @effect/vitest as an assertion", function () {
	assert.strictEqual(1 + 1, 2)
})

it("checks nothing", function () {
	release()
})
