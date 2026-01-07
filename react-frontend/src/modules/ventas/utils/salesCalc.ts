import { round2, toNumberSafe } from "../../../utils/number"

export type SaleLineInput = {
	price: unknown
	qty: unknown
	discount: unknown
}

export function calcLineTotal(price: unknown, qty: unknown, discount: unknown): number {
	const p = toNumberSafe(price)
	const q = toNumberSafe(qty)
	const d = toNumberSafe(discount)
	const line = q * p - d
	return round2(Math.max(line, 0))
}

export function calcTotals(lines: SaleLineInput[], ivaRate: number): { subtotal: number; impuesto: number; total: number } {
	const safeRate = Number.isFinite(ivaRate) ? ivaRate : 0
	const subtotal = round2(lines.reduce((acc, line) => acc + calcLineTotal(line.price, line.qty, line.discount), 0))
	const impuesto = round2(subtotal * safeRate)
	const total = round2(subtotal + impuesto)
	return { subtotal, impuesto, total }
}
