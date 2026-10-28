/** One product in the cart, with how many the customer wants. */
export interface Line {
	readonly sku: string
	readonly quantity: number
}

export const make = (sku: string): Line => ({ sku, quantity: 1 })
