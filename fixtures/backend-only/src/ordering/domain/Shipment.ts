import { Schema } from "effect"

/** A parcel on its way to the customer. */
export class Shipment extends Schema.Class<Shipment>("Shipment")({ id: Schema.String }) {}

export const Id = Schema.String.pipe(Schema.brand("ShipmentId"))

/** Passes: the tag keeps the concept's words and ends with the class name. */
export class NotFound extends Schema.TaggedError<NotFound>()("ShipmentNotFound", { id: Id }) {}

/** Fails schema-class-identifiers: the tag doesn't end with the class name. */
export class Lost extends Schema.TaggedError<Lost>()("ShipmentMissing", { id: Id }) {}
