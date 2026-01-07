import { CreditCard, Loader2, NotebookPen, XOctagon } from "lucide-react"
import { useState } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { VentaDetailRecord } from "../../../services/salesService"
import { formatMoneyOrDash } from "../../../utils/number"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import { SaleInvoicePrintable } from "./SaleInvoicePrintable"
import { downloadSalePdf } from "../utils/salePdf"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	sale: VentaDetailRecord | null
	isLoading: boolean
	isError: boolean

	dateFormatter: Intl.DateTimeFormat

	onEdit: () => void
	onCancel: () => void
	onReactivate: () => void
	onClose: () => void

	supportsReactivate: boolean
	busy?: boolean
	errorMessage?: string | null
}

export function SalesDetailDrawer(props: Props) {
  const [invoiceOpen, setInvoiceOpen] = useState(false)
	const sale = props.sale
  const emailSale = (venta: VentaDetailRecord) => {
    const subject = `Factura ${venta.numero_factura || ""}`
    const clienteNombre = venta.cliente ? `${venta.cliente.nombres} ${venta.cliente.apellidos}` : "Cliente"
    const body = [
      `Estimado/a ${clienteNombre},`,
      "\nAdjunto la factura.",
      venta.fecha_factura ? `\nFecha: ${new Date(venta.fecha_factura).toLocaleString("es-EC")}` : "",
      `\nTotal: $${Number(venta.total ?? 0).toFixed(2)}`,
      "\n\nGracias por su compra."
    ].join("")
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">Detalle de venta</DrawerTitle>
						<DrawerDescription>Cabecera, productos y crédito (si aplica).</DrawerDescription>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={props.onEdit}
								disabled={!sale || sale.id_estado !== 1}
								className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<NotebookPen className="h-4 w-4" />
								Editar observaciones
							</button>

							<button
								type="button"
								onClick={props.onCancel}
								disabled={!sale || sale.id_estado !== 1 || props.busy}
								className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<XOctagon className="h-4 w-4" />
								Anular
							</button>

							<button
								type="button"
								onClick={props.onReactivate}
								disabled={!sale || sale.id_estado === 1 || !props.supportsReactivate || props.busy}
								className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
								title={props.supportsReactivate ? "" : "Reactivar no disponible para créditos"}
							>
								Reactivar
							</button>

							<button
								type="button"
								onClick={props.onClose}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
							>
								Cerrar
							</button>
						</div>
					</DrawerHeader>

					<div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
						{props.isLoading && (
							<div className="flex items-center gap-2 text-slate-500">
								<Loader2 className="h-4 w-4 animate-spin" />
								Cargando detalle...
							</div>
						)}

						{props.isError && !props.isLoading && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el detalle.</div>
						)}

						{sale && (
							<>
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-base font-semibold text-slate-900">{sale.numero_factura}</p>
											<p className="text-xs text-slate-500">
												{sale.fecha_factura ? props.dateFormatter.format(new Date(sale.fecha_factura)) : "—"}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span
												className={
													"rounded-full px-2 py-0.5 text-[11px] font-semibold " +
													(sale.forma_pago === "CREDITO" ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700")
												}
											>
												{sale.forma_pago === "CREDITO" ? "Crédito" : "Contado"}
											</span>
											<span
												className={
													"rounded-full px-2 py-0.5 text-[11px] font-semibold " +
													(sale.id_estado === 1 ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700")
												}
											>
												{sale.id_estado === 1 ? "Activa" : "Anulada"}
											</span>
										</div>
									</div>

									<div className="mt-3 grid gap-2">
										<p>
											Cliente: {sale.cliente ? `${sale.cliente.nombres} ${sale.cliente.apellidos}` : "—"}
										</p>
										<p className="text-xs text-slate-500">Identificación: {sale.cliente?.cedula ?? "—"}</p>
										<p className="text-xs text-slate-500">Registrada por: {sale.usuario?.nombre_completo ?? "—"}</p>
										{sale.observacion?.trim() ? (
											<p className="text-xs text-slate-500">Obs: {sale.observacion}</p>
										) : (
											<p className="text-xs text-slate-500">Obs: —</p>
										)}
									</div>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-white">
									<div className="overflow-x-auto">
										<table className="min-w-full divide-y divide-slate-200 text-sm">
											<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
												<tr>
													<th className="px-4 py-3 text-left">Producto</th>
													<th className="px-4 py-3 text-left">Cantidad</th>
													<th className="px-4 py-3 text-left">Precio</th>
													<th className="px-4 py-3 text-left">Desc.</th>
													<th className="px-4 py-3 text-left">Subtotal</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-200">
												{sale.detalle_factura.length === 0 ? (
													<tr>
														<td className="px-4 py-4 text-slate-500" colSpan={5}>
															Sin detalle.
														</td>
													</tr>
												) : (
													sale.detalle_factura.map((detalle) => (
														<tr key={detalle.id_detalle_factura}>
															<td className="px-4 py-3">
																<p className="font-medium text-slate-900">{detalle.producto?.nombre_producto ?? "—"}</p>
																<p className="text-xs text-slate-500">{detalle.producto?.codigo_producto ?? "—"}</p>
															</td>
															<td className="px-4 py-3 text-slate-700">{detalle.cantidad}</td>
															<td className="px-4 py-3 text-slate-700">{formatMoneyOrDash(detalle.precio_unitario)}</td>
															<td className="px-4 py-3 text-slate-700">{formatMoneyOrDash(detalle.descuento)}</td>
															<td className="px-4 py-3 font-semibold text-slate-900">{formatMoneyOrDash(detalle.subtotal)}</td>
														</tr>
													))
												)}
											</tbody>
										</table>
									</div>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
									<div className="flex items-center justify-between">
										<span>Subtotal</span>
										<span>{formatMoneyOrDash(sale.subtotal)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>IVA</span>
										<span>{formatMoneyOrDash(sale.impuesto)}</span>
									</div>
									<div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
										<span>Total</span>
										<span>{formatMoneyOrDash(sale.total)}</span>
									</div>
								</div>

								<div className="mt-2 flex flex-wrap items-center justify-end gap-2">
									<button type="button" onClick={() => setInvoiceOpen(true)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Imprimir / Exportar</button>
									<button type="button" onClick={() => downloadSalePdf(sale)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Descargar PDF</button>
									<button type="button" onClick={() => emailSale(sale)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Enviar por correo</button>
								</div>

								{sale.credito && (
									<div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-slate-700">
										<div className="flex items-center justify-between">
											<p className="font-semibold">Crédito #{sale.credito.id_credito}</p>
											<CreditCard className="h-4 w-4 text-purple-500" />
										</div>
										<p>Monto total: {formatMoneyOrDash(sale.credito.monto_total)}</p>
										<p>Saldo pendiente: {formatMoneyOrDash(sale.credito.saldo_pendiente)}</p>
									</div>
								)}

								{props.errorMessage && (
									<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{props.errorMessage}</div>
								)}
							</>
						)}
					</div>
				</div>
			</DrawerContent>

			{sale && (
				<Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
					<DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton>
						<DialogHeader className="no-print">
							<DialogTitle>Factura de venta</DialogTitle>
						</DialogHeader>
						<SaleInvoicePrintable sale={sale} />
						<div className="mt-4 flex flex-wrap items-center justify-end gap-2 no-print">
							<button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Imprimir</button>
							<button type="button" onClick={() => downloadSalePdf(sale)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Descargar PDF</button>
							<button type="button" onClick={() => emailSale(sale)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Enviar por correo</button>
							<button type="button" onClick={() => setInvoiceOpen(false)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Cerrar</button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</Drawer>
	)
}
