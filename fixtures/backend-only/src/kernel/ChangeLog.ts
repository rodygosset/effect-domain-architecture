import type * as Order from "../ordering/domain/Order"

/** Who changed a record and when, oldest first. Reading a context ties every context to it. */
export interface ChangeLog {
	readonly entries: ReadonlyArray<{ readonly username: string; readonly at: string }>
	readonly orders: ReadonlyArray<Order.Order>
}

export const empty: ChangeLog = { entries: [], orders: [] }

export const record = (log: ChangeLog, username: string, at: string): ChangeLog => ({
	entries: [...log.entries, { username, at }],
	orders: log.orders,
})
