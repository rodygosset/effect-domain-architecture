import { Schema } from "effect"

/** A parcel on its way to the customer. */
export class Shipment extends Schema.Class<Shipment>("Shipment")({ id: Schema.String }) {}

export const Id = Schema.String.pipe(Schema.brand("ShipmentId"))

/** Passes: the name ends with Error, and the tag keeps the concept's words and ends with the class name. */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()("ShipmentNotFoundError", { id: Id }) {}

/** Fails schema-class-identifiers: the tag doesn't end with the class name. */
export class LostError extends Schema.TaggedError<LostError>()("ShipmentMissingError", { id: Id }) {}

/** Fails schema-class-identifiers: an error whose name doesn't end with Error. */
export class Delayed extends Schema.TaggedError<Delayed>()("ShipmentDelayed", { id: Id }) {}

/** Fails schema-class-identifiers: data whose name ends with Error. */
export class TrackingError extends Schema.Class<TrackingError>("TrackingError")({ code: Schema.String }) {}
