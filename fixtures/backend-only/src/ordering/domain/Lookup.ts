/** What a lookup returns: whether it found a value, and the value. */
type Lookup<A> = Readonly<{ isFound: boolean; value: A }>

/** Fails no-unknown-type-argument: `Lookup<unknown>` erases the type of the value. */
export const isFoundLookup = (lookup: Lookup<unknown>) => lookup.isFound

/** Passes: a type parameter keeps the value's type. */
export const valueOf = <A>(lookup: Lookup<A>) => lookup.value

/** Passes: a type parameter's bound may say `unknown`, because it means any value. */
export const toLookups = <L extends Lookup<unknown>>(lookups: ReadonlyArray<L>) => lookups
