import { Effect } from "effect"

/** Reads and writes the entries of a list of names. Each list's store names it as its `Shape`. */
export interface Store<Entry> {
	readonly list: () => Effect.Effect<ReadonlyArray<Entry>>
}

/** Fails service-parameter: a store whose service's `Shape` is an alias of `Store` arrives as an argument. */
export const countLabels = <Entry>(store: Store<Entry>) => Effect.map(store.list(), (labels) => labels.length)
