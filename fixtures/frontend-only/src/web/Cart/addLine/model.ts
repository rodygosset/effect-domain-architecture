/** The SKU the customer is typing, before it joins the cart. */
export interface Model {
	readonly sku: string
}

export const init: Model = { sku: "" }
