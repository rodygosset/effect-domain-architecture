import { Effect } from "effect"
import * as Shipment from "../domain/Shipment"

/** Fails error-construction twice: a yielded error built with make, and a Schema class built with new. */
export const track = Effect.fn("Shipping.track")(function* (id: Shipment.Shipment["id"], isKnown: boolean) {
	if (!isKnown) return yield* Shipment.NotFoundError.make({ id: Shipment.Id.make(id) })
	return new Shipment.Shipment({ id })
})

/** Passes: a yielded error built with new, and a Schema class built with make. */
export const find = Effect.fn("Shipping.find")(function* (id: Shipment.Shipment["id"], isKnown: boolean) {
	if (!isKnown) return yield* new Shipment.NotFoundError({ id: Shipment.Id.make(id) })
	return Shipment.Shipment.make({ id })
})
