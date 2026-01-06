import type { ProductCategoryValue } from "../../config/productCategories"

export type ProductoRecord = {
	id_producto: number
	codigo_producto: string
	nombre_producto: string
	descripcion: string | null
	id_proveedor: number | null
	precio_compra: number
	precio_venta: number
	cantidad_stock: number
	stock_minimo: number
	proveedor?: {
		id_proveedor: number
		nombre_proveedor: string
	} | null
}

export type ProveedorRecord = {
	id_proveedor: number
	nombre_proveedor: string
}

export type VentaListRecord = {
	id_factura: number
	numero_factura: string
	fecha_factura: string
}

export type VentaDetailRecord = VentaListRecord & {
	detalle_factura: Array<{
		id_detalle_factura: number
		id_producto: number
		cantidad: number
		precio_unitario: number
		subtotal: number
		producto: {
			codigo_producto: string
			nombre_producto: string
		}
	}>
}

export type ProductSaleLine = {
	id_factura: number
	numero_factura: string
	fecha_factura: string
	cantidad: number
	precio_unitario: number
	subtotal: number
}

export type ProductSalesSummary = {
	totalUnitsSold: number
	last30DaysUnitsSold: number
	lastSaleDate: string | null
	recentLines: ProductSaleLine[]
}

export type StockStatus = "SIN_STOCK" | "CRITICAL" | "LOW" | "NORMAL"
export type SalesStatus = "NO_SALES_30D" | "ACTIVE"
export type MarginStatus = "NO_COST" | "LOW_MARGIN" | "OK"

export type StockFilterValue = "all" | StockStatus

export type SalesFilterValue = "all" | SalesStatus
export type MarginFilterValue = "all" | MarginStatus

export type SortValue =
	| "name_asc"
	| "name_desc"
	| "stock_asc"
	| "stock_desc"
	| "price_asc"
	| "price_desc"
	| "recent"
	| "margin_asc"
	| "margin_desc"
	| "status_stock"
	| "status_sales"
	| "status_margin"

export type ProductsFilters = {
	categoria: "all" | ProductCategoryValue
	proveedorId: "all" | number
	stock: StockFilterValue
	sales: SalesFilterValue
	margin: MarginFilterValue
	orden: SortValue
}

export type ProductsViewMode = "table" | "cards"

export type ProductoPayload = {
	codigo_producto: string
	nombre_producto: string
	descripcion: string | null
	id_proveedor: number
	precio_compra: number
	precio_venta: number
	cantidad_stock: number
	stock_minimo: number
}

export type KardexMovimientoRecord = {
	id_kardex: number
	id_producto: number
	fecha_movimiento: string
	tipo_movimiento: string
	origen: string | null
	id_referencia: number | null
	cantidad: number
	costo_unitario: number | null
	comentario: string | null
	id_estado: number | null
	producto?: {
		codigo_producto: string
		nombre_producto: string
	} | null
}
