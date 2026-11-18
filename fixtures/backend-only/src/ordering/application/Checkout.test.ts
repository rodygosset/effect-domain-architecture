import { vi } from "vitest"

const release = vi.fn()
vi.mock("./OrderStore")
vi.spyOn(globalThis, "setTimeout")
vi.stubGlobal("fetch", release)
vi.useFakeTimers()
