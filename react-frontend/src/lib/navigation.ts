import type { LucideIcon } from "lucide-react"
import { CreditCard, Home, Package, ReceiptText, ShoppingCart, Truck, Users } from "lucide-react"

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const appNavItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Productos", to: "/productos", icon: Package },
  { label: "Ventas", to: "/ventas", icon: ShoppingCart },
  { label: "Compras", to: "/compras", icon: ReceiptText },
  { label: "Clientes", to: "/clientes", icon: Users },
  { label: "Proveedores", to: "/proveedores", icon: Truck },
  { label: "Créditos", to: "/creditos", icon: CreditCard },
]