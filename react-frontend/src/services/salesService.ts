import { httpRequest } from "./httpClient"
import { toNumberSafe } from "../utils/number"

export type FormaPago = "CONTADO" | "CREDITO"

export type VentaListRecord = {
	id_factura: number
	numero_factura: string
	fecha_factura: string
	forma_pago: FormaPago
	observacion: string | null
	subtotal: number
	impuesto: number
	total: number
	id_estado: number
	cliente: {
		id_cliente: number
		nombres: string
		apellidos: string
		cedula: string
	} | null
	usuario: {
		id_usuario: number
		nombre_completo: string
	} | null
}

export type VentaDetailRecord = VentaListRecord & {
	detalle_factura: Array<{
		id_detalle_factura: number
		id_producto: number
		cantidad: number
		precio_unitario: number
		descuento: number
		subtotal: number
		producto: {
			codigo_producto: string
			nombre_producto: string
		}
	}>
	credito: {
		id_credito: number
		monto_total: number
		saldo_pendiente: number
		fecha_inicio: string
		fecha_fin: string | null
		cuota: Array<{
			id_cuota: number
			numero_cuota: number
			fecha_vencimiento: string
			monto_cuota: number
			monto_pagado: number
			estado_cuota: string
		}>
	} | null
}

export type VentaPayload = {
	id_cliente: number
	forma_pago: FormaPago
	observacion: string | null
	detalle: Array<{
		id_producto: number
		cantidad: number
		precio_unitario: number
		descuento: number
	}>
	creditoConfig?: {
		numero_cuotas: number
		fecha_primer_vencimiento: string
		dias_entre_cuotas?: number
	}
}

function normalizeVentaNumbers<T extends { subtotal?: any; impuesto?: any; total?: any }>(venta: T): T {
	return {
		...venta,
		subtotal: toNumberSafe((venta as any).subtotal),
		impuesto: toNumberSafe((venta as any).impuesto),
		total: toNumberSafe((venta as any).total),
	} as T
}

function normalizeVentaListItem(raw: any): VentaListRecord {
	const base = normalizeVentaNumbers(raw)
	return {
		...base,
		id_factura: toNumberSafe(raw?.id_factura),
		numero_factura: String(raw?.numero_factura ?? ""),
		fecha_factura: String(raw?.fecha_factura ?? ""),
		forma_pago: (raw?.forma_pago === "CREDITO" ? "CREDITO" : "CONTADO") as FormaPago,
		observacion: raw?.observacion ?? null,
		id_estado: toNumberSafe(raw?.id_estado),
		cliente: raw?.cliente ?? null,
		usuario: raw?.usuario ?? null,
	}
}

function normalizeVentaDetail(raw: any): VentaDetailRecord {
	const header = normalizeVentaListItem(raw)
	const detalle = Array.isArray(raw?.detalle_factura) ? raw.detalle_factura : []
	return {
		...(header as any),
		detalle_factura: detalle.map((d: any) => ({
			...d,
			id_detalle_factura: toNumberSafe(d?.id_detalle_factura),
			id_producto: toNumberSafe(d?.id_producto),
			cantidad: toNumberSafe(d?.cantidad),
			precio_unitario: toNumberSafe(d?.precio_unitario),
			descuento: toNumberSafe(d?.descuento),
			subtotal: toNumberSafe(d?.subtotal),
		})),
		credito: raw?.credito
			? {
				...raw.credito,
				id_credito: toNumberSafe(raw.credito?.id_credito),
				monto_total: toNumberSafe(raw.credito?.monto_total),
				saldo_pendiente: toNumberSafe(raw.credito?.saldo_pendiente),
				cuota: Array.isArray(raw.credito?.cuota)
					? raw.credito.cuota.map((c: any) => ({
						...c,
						id_cuota: toNumberSafe(c?.id_cuota),
						numero_cuota: toNumberSafe(c?.numero_cuota),
						monto_cuota: toNumberSafe(c?.monto_cuota),
						monto_pagado: toNumberSafe(c?.monto_pagado),
					}))
					: [],
			}
			: null,
	}
}

export const salesService = {
	async listSales(): Promise<VentaListRecord[]> {
		const data = await httpRequest<any>("/ventas")
		if (!Array.isArray(data)) return []
		return data.map(normalizeVentaListItem)
	},

	async getSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<any>(`/ventas/${id}`)
		return normalizeVentaDetail(data)
	},

	async createSale(payload: VentaPayload): Promise<VentaDetailRecord> {
		const data = await httpRequest<any>("/ventas", { method: "POST", body: payload })
		return normalizeVentaDetail(data)
	},

	async updateSale(id: number, payload: { observacion: string | null }): Promise<VentaDetailRecord> {
		const data = await httpRequest<any>(`/ventas/${id}`, { method: "PUT", body: payload })
		return normalizeVentaDetail(data)
	},

	async cancelSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<any>(`/ventas/${id}`, { method: "DELETE" })
		return normalizeVentaDetail(data)
	},

	async reactivateSale(id: number): Promise<VentaDetailRecord> {
		const data = await httpRequest<any>(`/ventas/${id}/reactivar`, { method: "POST" })
		return normalizeVentaDetail(data)
	},
}
