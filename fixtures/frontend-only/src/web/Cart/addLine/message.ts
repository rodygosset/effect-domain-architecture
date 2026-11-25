/** The customer typed in the SKU field. */
export interface EditedSku {
	readonly _tag: "EditedSku"
	readonly sku: string
}

export type Message = EditedSku
