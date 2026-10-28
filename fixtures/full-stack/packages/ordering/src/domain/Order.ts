/** An order a customer placed. */
export interface Order {
	readonly id: string
}

export const make = (id: string): Order => ({ id })
export const makeOrder = make
