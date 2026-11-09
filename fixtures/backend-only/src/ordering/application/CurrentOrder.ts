import { Context } from "effect"
import type * as Order from "../domain/Order"

/** The order a request works on. Its value is data, so functions may take an `Order.Order`. */
export type Shape = Order.Order

export class Service extends Context.Service<Service, Shape>()("ordering/application/CurrentOrder/Service") {}
