import * as Order from "../domain/Order"

export function totalOf(order: Order.Order): number {
	switch ((order as { _tag: string })._tag) {
		case "Paid":
			return 1
		default:
			return 0
	}
}

export const describe = (value: unknown, missing: string | null) => (typeof value === "string" ? value : missing)

export const createOrder = (id: string) => Order.make(id)

export const sorted = (lines: Array<number>) => lines.sort()

export const msg = "x"

export const hasLines = (order: Order.Order) => order.lines.length > 0

export const ready = (order: Order.Order) => order.lines.length > 0
export const basketTotal = 0
