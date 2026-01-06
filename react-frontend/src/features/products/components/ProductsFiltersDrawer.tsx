import type { Dispatch, SetStateAction } from "react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import { productCategories } from "../../../config/productCategories"

import type { ProductsFilters, ProveedorRecord } from "../product.types"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	filtersDraft: ProductsFilters
	setFiltersDraft: Dispatch<SetStateAction<ProductsFilters>>

	proveedores: ProveedorRecord[]

	onApply: () => void
	onCancel: () => void
	onClearDraft: () => void
}

export function ProductsFiltersDrawer(props: Props) {
	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">Filtros</DrawerTitle>
						<DrawerDescription>Refina el listado y aplica.</DrawerDescription>
					</DrawerHeader>

					<div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-6 py-5">
						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</label>
							<select
								value={props.filtersDraft.categoria}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										categoria: event.target.value as ProductsFilters["categoria"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todas</option>
								{productCategories.map((category) => (
									<option key={category.value} value={category.value}>
										{category.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</label>
							<select
								value={String(props.filtersDraft.proveedorId)}
								onChange={(event) => {
									const raw = event.target.value
									props.setFiltersDraft((prev) => ({
										...prev,
										proveedorId: raw === "all" ? "all" : Number(raw),
									}))
								}}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								{props.proveedores.map((prov) => (
									<option key={prov.id_proveedor} value={prov.id_proveedor}>
										{prov.nombre_proveedor}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</label>
							<select
								value={props.filtersDraft.stock}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										stock: event.target.value as ProductsFilters["stock"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								<option value="CRITICAL">Crítico</option>
								<option value="LOW">Bajo</option>
								<option value="NORMAL">Normal</option>
								<option value="SIN_STOCK">Sin stock</option>
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventas 30d</label>
							<select
								value={props.filtersDraft.sales}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										sales: event.target.value as ProductsFilters["sales"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todas</option>
								<option value="ACTIVE">Activas</option>
								<option value="NO_SALES_30D">Sin ventas 30d</option>
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Margen</label>
							<select
								value={props.filtersDraft.margin}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										margin: event.target.value as ProductsFilters["margin"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="all">Todos</option>
								<option value="OK">OK</option>
								<option value="LOW_MARGIN">Margen bajo</option>
								<option value="NO_COST">Sin costo</option>
							</select>
						</div>

						<div>
							<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar</label>
							<select
								value={props.filtersDraft.orden}
								onChange={(event) =>
									props.setFiltersDraft((prev) => ({
										...prev,
										orden: event.target.value as ProductsFilters["orden"],
									}))
								}
								className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="name_asc">Nombre A-Z</option>
								<option value="name_desc">Nombre Z-A</option>
								<option value="stock_asc">Stock asc</option>
								<option value="stock_desc">Stock desc</option>
								<option value="price_asc">Precio asc</option>
								<option value="price_desc">Precio desc</option>
								<option value="margin_asc">Margen asc</option>
								<option value="margin_desc">Margen desc</option>
								<option value="status_stock">Estado stock</option>
								<option value="status_sales">Estado ventas</option>
								<option value="status_margin">Estado margen</option>
								<option value="recent">Más recientes</option>
							</select>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
						<button
							type="button"
							onClick={props.onCancel}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
						>
							Cancelar
						</button>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={props.onClearDraft}
								className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								Limpiar
							</button>
							<button
								type="button"
								onClick={props.onApply}
								className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
							>
								Aplicar
							</button>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
