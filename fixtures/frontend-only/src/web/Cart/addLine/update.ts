import type { Message } from "./message"
import type { Model } from "./model"

export const update = (model: Model, message: Message): Model => ({ ...model, sku: message.sku })
