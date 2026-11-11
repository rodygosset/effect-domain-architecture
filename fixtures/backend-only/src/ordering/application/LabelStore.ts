import { Context } from "effect"
import type * as Labels from "./Labels"

/** Reads and writes the labels of orders. */
export type Shape = Labels.Store<string>

export class Service extends Context.Service<Service, Shape>()("ordering/application/LabelStore/Service") {}
