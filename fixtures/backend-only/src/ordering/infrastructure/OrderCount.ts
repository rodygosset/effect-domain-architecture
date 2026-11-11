import { Effect } from "effect"
import { SqlClient, type Statement } from "effect/sql"

/** Fails service-parameter: a library's service, the SQL client, arrives as an argument. */
export const countOrders = (sql: SqlClient.SqlClient) => sql`SELECT count(*) FROM orders`

/** Fails service-parameter: the statement builder the SQL client extends is the client all the same. */
export const orderById = (sql: Statement.Constructor) => sql`ORDER BY id`

/** Passes: the client is yielded, so the type names the requirement. */
export const countStored = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`SELECT count(*) FROM orders`)
