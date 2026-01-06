import type {
	MarginFilterValue,
	MarginStatus,
	ProductoRecord,
	ProductSalesSummary,
	SalesFilterValue,
	SalesStatus,
	StockFilterValue,
	StockStatus as ProductStockStatus,
} from "./product.types"

export type StockStatus = "out" | "critical" | "low" | "normal"

export const resolveStockStatus = (producto: Pick<ProductoRecord, "cantidad_stock" | "stock_minimo">): StockStatus => {
	const stock = producto.cantidad_stock
	const minimo = Math.max(0, producto.stock_minimo)

	if (stock <= 0) return "out"
	if (stock <= minimo) return "critical"
	if (minimo > 0 && stock <= minimo * 2) return "low"
	return "normal"
}

export const stockStatusLabel = (status: StockStatus) => {
	switch (status) {
		case "out":
			return "Sin stock"
		case "critical":
			return "Crítico"
		case "low":
			return "Bajo"
		default:
			return "Normal"
	}
}

export const matchesStockFilter = (producto: Pick<ProductoRecord, "cantidad_stock" | "stock_minimo">, filter: StockFilterValue) => {
	if (filter === "all") return true
	const status = resolveStockStatus(producto)
	switch (filter) {
		case "SIN_STOCK":
			return status === "out"
		case "CRITICAL":
			return status === "critical"
		case "LOW":
			return status === "low"
		case "NORMAL":
			return status === "normal"
	}
}

export const getPurchasePriceDisplay = (precio_compra: number) => {
	return precio_compra > 0 ? precio_compra : null
}

export const computeMargin = (precioCompra: number, precioVenta: number) => {
	if (!(precioCompra > 0) || !(precioVenta > 0)) return null
	return precioVenta - precioCompra
}

export const computeMarginPercent = (precioCompra: number, precioVenta: number) => {
	const margin = computeMargin(precioCompra, precioVenta)
	if (margin === null) return null
	if (!(precioCompra > 0)) return null
	return (margin / precioCompra) * 100
}

export const DEFAULT_LOW_MARGIN_THRESHOLD_PERCENT = 10

export const resolveProductStockStatus = (
	producto: Pick<ProductoRecord, "cantidad_stock" | "stock_minimo">,
): ProductStockStatus => {
	switch (resolveStockStatus(producto)) {
		case "out":
			return "SIN_STOCK"
		case "critical":
			return "CRITICAL"
		case "low":
			return "LOW"
		default:
			return "NORMAL"
	}
}

export const productStockStatusLabel = (status: ProductStockStatus) => {
	switch (status) {
		case "SIN_STOCK":
			return "Sin stock"
		case "CRITICAL":
			return "Crítico"
		case "LOW":
			return "Bajo"
		default:
			return "Normal"
	}
}

export const resolveSalesStatus = (summary: Pick<ProductSalesSummary, "last30DaysUnitsSold"> | null | undefined): SalesStatus | null => {
	if (!summary) return null
	return summary.last30DaysUnitsSold <= 0 ? "NO_SALES_30D" : "ACTIVE"
}

export const salesStatusLabel = (status: SalesStatus) => {
	switch (status) {
		case "NO_SALES_30D":
			return "Sin ventas 30d"
		default:
			return "Activas"
	}
}

export const resolveMarginStatus = (
	producto: Pick<ProductoRecord, "precio_compra" | "precio_venta">,
	lowMarginThresholdPercent: number = DEFAULT_LOW_MARGIN_THRESHOLD_PERCENT,
): MarginStatus => {
	const compra = producto.precio_compra
	const venta = producto.precio_venta
	if (!(compra > 0)) return "NO_COST"

	const marginPercent = computeMarginPercent(compra, venta)
	if (marginPercent === null) return "NO_COST"
	return marginPercent < lowMarginThresholdPercent ? "LOW_MARGIN" : "OK"
}

export const marginStatusLabel = (status: MarginStatus) => {
	switch (status) {
		case "NO_COST":
			return "Sin costo"
		case "LOW_MARGIN":
			return "Margen bajo"
		default:
			return "OK"
	}
}

export const matchesSalesFilter = (status: SalesStatus | null, filter: SalesFilterValue) => {
	if (filter === "all") return true
	return status === filter
}

export const matchesMarginFilter = (producto: Pick<ProductoRecord, "precio_compra" | "precio_venta">, filter: MarginFilterValue) => {
	if (filter === "all") return true
	return resolveMarginStatus(producto) === filter
}

export const stockStatusWeight = (status: ProductStockStatus) => {
	switch (status) {
		case "SIN_STOCK":
			return 0
		case "CRITICAL":
			return 1
		case "LOW":
			return 2
		default:
			return 3
	}
}

export const salesStatusWeight = (status: SalesStatus | null) => {
	if (status === "NO_SALES_30D") return 0
	if (status === "ACTIVE") return 1
	return 2
}

export const marginStatusWeight = (status: MarginStatus) => {
	switch (status) {
		case "NO_COST":
			return 0
		case "LOW_MARGIN":
			return 1
		default:
			return 2
	}
}
