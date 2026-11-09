import { Effect, Schema } from "effect"
import * as Shipment from "../domain/Shipment"

/** Fails error-construction twice: a yielded error built with make, and a Schema class built with new. */
export const track = Effect.fn("Shipping.track")(function* (id: Shipment.Shipment["id"], isKnown: boolean) {
	if (!isKnown) return yield* Shipment.NotFoundError.make({ id: Shipment.Id.make(id) })
	return new Shipment.Shipment({ id })
})

/** Fails error-construction: an error built with make inside Effect.fail. */
export const locate = (id: Shipment.Shipment["id"]) =>
	Effect.fail(Shipment.NotFoundError.make({ id: Shipment.Id.make(id) }))

/** Fails error-construction: an error's make passed as a function. */
export const recover = (ids: ReadonlyArray<{ readonly id: Shipment.Shipment["id"] & Shipment.Id }>) =>
	ids.map(Shipment.NotFoundError.make)

/** Passes: errors built with new wherever they go, and a Schema class built with make. */
export const find = Effect.fn("Shipping.find")(function* (id: Shipment.Shipment["id"], isKnown: boolean) {
	if (!isKnown) return yield* new Shipment.NotFoundError({ id: Shipment.Id.make(id) })
	yield* Effect.mapError(Effect.fail("missing"), () => new Shipment.NotFoundError({ id: Shipment.Id.make(id) }))
	return Shipment.Shipment.make({ id })
})

/** Fails codec-placement: the codec of a shipment belongs in Shipment.ts, as Shipment.Json. */
export const ShipmentJson = Schema.toCodecJson(Shipment.Shipment)

/** Passes: the codec comes from its concept's module. */
export const decodeShipment = Schema.decodeUnknownOption(Shipment.Json)
