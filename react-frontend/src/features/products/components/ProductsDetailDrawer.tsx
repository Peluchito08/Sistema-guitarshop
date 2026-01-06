import { useEffect, useMemo, useState } from "react"
import { Loader2, Package } from "lucide-react"
import { isAxiosError } from "axios"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"

import type { KardexMovimientoRecord, ProductoRecord, ProductSalesSummary } from "../product.types"
import {
	computeMargin,
	marginStatusLabel,
	productStockStatusLabel,
	resolveMarginStatus,
	resolveProductStockStatus,
	resolveSalesStatus,
	salesStatusLabel,
} from "../product.utils"

type SalesState = {
	isLoading: boolean
	isError: boolean
	error?: unknown
	data?: ProductSalesSummary
}

type MovementsState = {
	isLoading: boolean
	isError: boolean
	data?: KardexMovimientoRecord[]
}

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	product: ProductoRecord | null
	inferCategoryFromCode: (code: string) => string | null

	currency: Intl.NumberFormat
	dateFormatter: Intl.DateTimeFormat

	sales: SalesState
	onRetrySales: () => void

	movements: MovementsState
	onRetryMovements: () => void

	onEdit: () => void
	onAdjustStock: () => void
	onHistory: () => void
	onClose: () => void
}

export function ProductsDetailDrawer(props: Props) {
	const detailProduct = props.product
	const [movementsLimit, setMovementsLimit] = useState(10)

	useEffect(() => {
		setMovementsLimit(10)
	}, [detailProduct?.id_producto])

	const stockStatus = detailProduct ? resolveProductStockStatus(detailProduct) : null
	const salesStatus = resolveSalesStatus(props.sales.data)
	const marginStatus = detailProduct ? resolveMarginStatus(detailProduct) : null

	const salesError = props.sales.isError ? props.sales.error : null
	const salesErrorStatus = isAxiosError(salesError) ? salesError.response?.status : undefined
	const isSalesHistoryUnavailable = salesErrorStatus === 404 || salesErrorStatus === 501
	const isSalesNetworkError = isAxiosError(salesError) && !salesError.response

	const stockStatusClass =
		stockStatus === "SIN_STOCK"
			? "bg-slate-100 text-slate-700"
			: stockStatus === "CRITICAL"
				? "bg-red-50 text-red-700"
				: stockStatus === "LOW"
					? "bg-amber-50 text-amber-700"
					: "bg-emerald-50 text-emerald-700"
	const salesStatusClass =
		salesStatus === null
			? "bg-slate-100 text-slate-700"
			: salesStatus === "NO_SALES_30D"
				? "bg-amber-50 text-amber-700"
				: "bg-emerald-50 text-emerald-700"
	const marginStatusClass =
		marginStatus === "NO_COST"
			? "bg-slate-100 text-slate-700"
			: marginStatus === "LOW_MARGIN"
				? "bg-amber-50 text-amber-700"
				: "bg-emerald-50 text-emerald-700"

	const buildMovementType = (m: KardexMovimientoRecord): "VENTA" | "AJUSTE" => {
		const raw = `${m.tipo_movimiento ?? ""} ${m.origen ?? ""}`.toUpperCase()
		if (raw.includes("VENTA") || raw.includes("FACTURA")) return "VENTA"
		return "AJUSTE"
	}

	const getMovementReference = (m: KardexMovimientoRecord): string => {
		const type = buildMovementType(m)
		if (type === "VENTA") {
			return m.id_referencia ? `Factura #${m.id_referencia}` : "Factura"
		}
		return m.comentario?.trim() ? m.comentario : "Ajuste"
	}

	const filteredMovements = useMemo(() => {
		if (!detailProduct) return []
		return (props.movements.data ?? []).filter((m) => m.id_producto === detailProduct.id_producto)
	}, [detailProduct, props.movements.data])

	const visibleMovements = useMemo(() => {
		return filteredMovements.slice(0, movementsLimit)
	}, [filteredMovements, movementsLimit])

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				{detailProduct && (
					<div className="flex h-dvh flex-col">
						<DrawerHeader>
							<DrawerTitle className="pr-10">{detailProduct.nombre_producto}</DrawerTitle>
							<DrawerDescription className="mt-1 flex flex-col gap-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
										{detailProduct.codigo_producto}
									</span>
									<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
										{(props.inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}
									</span>
								</div>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salud del producto</p>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>
											Stock: {stockStatus ? productStockStatusLabel(stockStatus) : "—"}
										</span>
										<span className={`rounded-full px-3 py-1 text-xs font-semibold ${salesStatusClass}`}>
											Ventas: {salesStatus ? salesStatusLabel(salesStatus) : "—"}
										</span>
										<span className={`rounded-full px-3 py-1 text-xs font-semibold ${marginStatusClass}`}>
											Margen: {marginStatus ? marginStatusLabel(marginStatus) : "—"}
										</span>
									</div>
								</div>
							</DrawerDescription>
							<div className="mt-4 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={props.onEdit}
									className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
								>
									Editar
								</button>
								<button
									type="button"
									onClick={props.onAdjustStock}
									className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
								>
									Ajustar stock
								</button>
								<button
									type="button"
									onClick={props.onHistory}
									className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
								>
									Historial
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
							{(() => {
								const statusText = stockStatus ? productStockStatusLabel(stockStatus) : "—"
								const purchaseDisplay = detailProduct.precio_compra > 0 ? props.currency.format(detailProduct.precio_compra) : "—"
								const margin = computeMargin(detailProduct.precio_compra, detailProduct.precio_venta)
								const percent =
									detailProduct.stock_minimo > 0
										? Math.min(100, Math.round((detailProduct.cantidad_stock / detailProduct.stock_minimo) * 100))
										: 100

								return (
									<>
										<div className="rounded-2xl border border-slate-200 p-4">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<p className="text-sm font-semibold text-slate-700">Stock</p>
												<button
													type="button"
													onClick={props.onAdjustStock}
													className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
												>
													Ajustar stock
												</button>
											</div>
											<div className="mt-3 grid gap-4 sm:grid-cols-3">
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual</p>
													<p className="mt-1 text-2xl font-semibold text-slate-900">{detailProduct.cantidad_stock}</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mínimo</p>
													<p className="mt-1 text-2xl font-semibold text-slate-900">{detailProduct.stock_minimo}</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
													<span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>
														{statusText}
													</span>
												</div>
											</div>
											<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
												<div className="h-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
											</div>
											<p className="mt-2 text-xs text-slate-500">Indicador respecto al stock mínimo.</p>
										</div>

										<div className="rounded-2xl border border-slate-200 p-4">
											<p className="text-sm font-semibold text-slate-700">Información general</p>
											<div className="mt-4 grid gap-4 sm:grid-cols-2">
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">
														{detailProduct.proveedor?.nombre_proveedor ?? "Sin proveedor"}
													</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.codigo_producto}</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">
														{(props.inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}
													</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">
														{detailProduct.descripcion?.trim() ? detailProduct.descripcion : "—"}
													</p>
												</div>
											</div>
										</div>

										<div className="rounded-2xl border border-slate-200 p-4">
											<p className="text-sm font-semibold text-slate-700">Precios</p>
											<div className="mt-4 grid gap-4 sm:grid-cols-3">
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Venta</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">{props.currency.format(detailProduct.precio_venta)}</p>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compra</p>
													<div className="mt-1 flex flex-wrap items-center gap-2">
														<p className="text-sm font-semibold text-slate-900">{purchaseDisplay}</p>
														{detailProduct.precio_compra > 0 ? null : (
															<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
																Sin costo
															</span>
														)}
													</div>
												</div>
												<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Margen</p>
													<p className="mt-1 text-sm font-semibold text-slate-900">
														{margin === null ? "—" : props.currency.format(margin)}
													</p>
												</div>
											</div>
										</div>
									</>
								)
							})()}

							<div className="rounded-2xl border border-slate-200 p-4">
								<p className="text-sm font-semibold text-slate-700">Ventas</p>
								{props.sales.isLoading ? (
									<p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" /> Cargando...
									</p>
								) : props.sales.isError ? (
									isSalesHistoryUnavailable ? (
										<p className="mt-2 text-sm text-slate-600">Historial no disponible por el momento.</p>
									) : (
										<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700">
											<span>No se pudo cargar el historial.</span>
											{isSalesNetworkError ? (
												<button
													type="button"
													onClick={props.onRetrySales}
													className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
												>
													Reintentar
												</button>
											) : null}
										</div>
									)
								) : (
									<>
										<div className="mt-3 grid gap-4 sm:grid-cols-3">
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total vendido</p>
												<p className="mt-1 text-2xl font-semibold text-slate-900">{props.sales.data?.totalUnitsSold ?? 0}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos 30 días</p>
												<p className="mt-1 text-2xl font-semibold text-slate-900">{props.sales.data?.last30DaysUnitsSold ?? 0}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última venta</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">
													{props.sales.data?.lastSaleDate
														? props.dateFormatter.format(new Date(props.sales.data.lastSaleDate))
														: "—"}
												</p>
											</div>
										</div>

										<div className="mt-4 overflow-x-auto">
											<table className="min-w-[620px] w-full text-sm">
												<thead>
													<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
														<th className="py-2 pr-3">Fecha</th>
														<th className="py-2 pr-3">Factura</th>
														<th className="py-2 pr-3">Cant.</th>
														<th className="py-2">Subtotal</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-slate-200">
													{(props.sales.data?.recentLines ?? []).length === 0 ? (
														<tr>
															<td colSpan={4} className="py-8 text-center text-sm text-slate-500">
																<Package size={28} className="mx-auto mb-2 opacity-50" />
																Sin ventas registradas para este producto.
															</td>
														</tr>
													) : (
														(props.sales.data?.recentLines ?? []).map((line) => (
															<tr key={`${line.id_factura}-${line.fecha_factura}-${line.cantidad}`}>
																<td className="py-3 pr-3 align-top text-xs text-slate-600">
																	{props.dateFormatter.format(new Date(line.fecha_factura))}
																</td>
																<td className="py-3 pr-3 align-top">
																	<span className="text-xs font-semibold text-slate-800">{line.numero_factura}</span>
																</td>
																<td className="py-3 pr-3 align-top text-xs font-semibold text-slate-800">{line.cantidad}</td>
																<td className="py-3 align-top text-xs font-semibold text-slate-900">{props.currency.format(line.subtotal)}</td>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>
									</>
								)}
							</div>
						</div>

							<div className="rounded-2xl border border-slate-200 p-4">
								<p className="text-sm font-semibold text-slate-700">Historial de movimientos</p>
								{props.movements.isLoading ? (
									<p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" /> Cargando...
									</p>
								) : props.movements.isError ? (
									<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
										<span className="text-slate-600">No se pudo cargar el historial.</span>
										<button
											type="button"
											onClick={props.onRetryMovements}
											className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Reintentar
										</button>
									</div>
								) : (
									<>
												<div className="mt-3 overflow-x-auto">
													<table className="min-w-[680px] w-full text-sm">
														<thead>
															<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
																<th className="py-2 pr-3">Tipo</th>
																<th className="py-2 pr-3">Fecha</th>
																<th className="py-2 pr-3">Cantidad</th>
																<th className="py-2">Referencia</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-slate-200">
															{visibleMovements.length === 0 ? (
																<tr>
																	<td colSpan={4} className="py-8 text-center text-sm text-slate-500">
																		<Package size={28} className="mx-auto mb-2 opacity-50" />
																		Aún no hay movimientos para mostrar.
																	</td>
																</tr>
															) : (
																visibleMovements.map((m) => {
																	const type = buildMovementType(m)
																	const qty = Number(m.cantidad ?? 0)
																	const qtyText = `${qty > 0 ? "+" : ""}${qty}`
																	const qtyClass = qty > 0 ? "text-emerald-700" : qty < 0 ? "text-red-700" : "text-slate-700"
																	return (
																		<tr key={m.id_kardex} className="align-top">
																			<td className="py-2 pr-3">
																				<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
																					{type}
																				</span>
																			</td>
																			<td className="py-2 pr-3 text-sm font-semibold text-slate-900">
																				{m.fecha_movimiento
																					? props.dateFormatter.format(new Date(m.fecha_movimiento))
																						: "—"}
																			</td>
																			<td className={`py-2 pr-3 text-sm font-semibold ${qtyClass}`}>{qtyText}</td>
																			<td className="py-2 text-sm text-slate-700">{getMovementReference(m)}</td>
																		</tr>
																	)
																})
																)}
														</tbody>
													</table>
												</div>

												{filteredMovements.length > visibleMovements.length && (
													<div className="mt-3 flex justify-center">
														<button
															type="button"
															onClick={() => setMovementsLimit(movementsLimit + 10)}
															className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
														>
															Ver más
														</button>
													</div>
												)}
									</>
								)}
							</div>
					</div>
				)}
			</DrawerContent>
		</Drawer>
	)
}
