import { Cart } from "../../domain"
import { Button } from "../../view"

/** The home page's view. */
export const view = () => `${Button.primary} ${Cart.makeLine("TEA-01").code}`
