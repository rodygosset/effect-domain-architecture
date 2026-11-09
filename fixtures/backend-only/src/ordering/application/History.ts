import * as ChangeLog from "../../kernel/ChangeLog"

/** Reaches past the kernel's entry, which only `index.ts` may be imported through. */
export const startHistory = () => ChangeLog.empty
