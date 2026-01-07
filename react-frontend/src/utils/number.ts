const defaultLocale = "es-EC"
const defaultCurrency = "USD"

const currencyFormatter = new Intl.NumberFormat(defaultLocale, {
	style: "currency",
	currency: defaultCurrency,
	minimumFractionDigits: 2,
})

export function toNumberSafe(value: unknown): number {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0
	}

	if (typeof value === "string") {
		const trimmed = value.trim()
		if (trimmed.length === 0) return 0

		// Normaliza: "10,50" -> "10.50" y elimina separadores de miles comunes.
		const normalized = trimmed
			.replace(/\s+/g, "")
			.replace(/\.(?=\d{3}(\D|$))/g, "")
			.replace(/,/g, ".")

		const parsed = Number(normalized)
		return Number.isFinite(parsed) ? parsed : 0
	}

	if (value === null || value === undefined) return 0

	// Maneja casos raros (boolean, objects) sin romper.
	try {
		const parsed = Number(value as any)
		return Number.isFinite(parsed) ? parsed : 0
	} catch {
		return 0
	}
}

export function round2(value: number): number {
	if (!Number.isFinite(value)) return 0
	return Math.round(value * 100) / 100
}

export function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min
	return Math.min(max, Math.max(min, value))
}

export function formatMoney(value: unknown): string {
	const n = typeof value === "number" ? value : toNumberSafe(value)
	return currencyFormatter.format(Number.isFinite(n) ? n : 0)
}

export function formatMoneyOrDash(value: unknown): string {
	const n = typeof value === "number" ? value : toNumberSafe(value)
	if (!Number.isFinite(n)) return "—"
	return currencyFormatter.format(n)
}
