/** An order a customer placed, with the lines they chose. */
export interface Order {
	readonly id: string
	readonly lines: ReadonlyArray<number>
}

export const make = (id: string): Order => ({ id, lines: [] })

export const isEmpty = (order: Order) => order.lines.length === 0
