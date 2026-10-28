import { readFileSync } from "node:fs"
import * as Line from "../../Cart/domain/Line"

export const lines = [Line.make("TEA-01")]
export const template = () => readFileSync("receipt.txt", "utf8")
