import { Schema } from "effect"

/** Narrow: one error and nothing else. It belongs in ChangeLog.ts as ChangeLog.EmptyError. */
export class ChangeLogEmptyError extends Schema.TaggedError<ChangeLogEmptyError>()("ChangeLogEmptyError", {}) {}
