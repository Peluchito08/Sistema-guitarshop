import type { ProductsViewMode } from "../product.types"

export type ProductsFilterChip = {
	key: "categoria" | "proveedor" | "stock" | "sales" | "margin" | "orden"
	label: string
}

type Props = {
	startItem: number
	endItem: number
	resultsCount: number

	searchInput: string
	onSearchInputChange: (next: string) => void

	onOpenFilters: () => void

	viewMode: ProductsViewMode
	onChangeViewMode: (next: ProductsViewMode) => void

	pageSize: number
	onChangePageSize: (next: number) => void

	onOpenCreate: () => void
	createDisabled?: boolean

	onOpenExport: () => void

	filterChips: ProductsFilterChip[]
	onRemoveChip: (key: ProductsFilterChip["key"]) => void
	onClearAllFilters: () => void
}

export function ProductsListHeader(props: Props) {
	return (
		<div className="px-6 py-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<p id="productos-listado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Listado
					</p>
					<p className="mt-1 text-sm font-semibold text-slate-900">Productos</p>
					<p className="text-xs text-slate-500">
						Mostrando {props.startItem}-{props.endItem} de {props.resultsCount} resultados.
					</p>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
					<input
						value={props.searchInput}
						onChange={(event) => props.onSearchInputChange(event.target.value)}
						placeholder="Buscar por código o nombre"
						className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-72"
					/>

					<button
						type="button"
						onClick={props.onOpenFilters}
						className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Filtros
					</button>

					<div className="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
						<button
							type="button"
							onClick={() => props.onChangeViewMode("table")}
							className={
								"px-4 py-2.5 text-sm font-semibold transition " +
								(props.viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")
							}
						>
							Tabla
						</button>
						<button
							type="button"
							onClick={() => props.onChangeViewMode("cards")}
							className={
								"px-4 py-2.5 text-sm font-semibold transition " +
								(props.viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")
							}
						>
							Cards
						</button>
					</div>

					<div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
						<label htmlFor="products-page-size" className="text-xs font-semibold text-slate-600">
							Por página
						</label>
						<select
							id="products-page-size"
							value={String(props.pageSize)}
							onChange={(event) => props.onChangePageSize(Number(event.target.value))}
							className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="8">8</option>
							<option value="16">16</option>
							<option value="24">24</option>
							<option value="32">32</option>
						</select>
					</div>


					<button
						type="button"
						onClick={props.onOpenCreate}
						disabled={props.createDisabled}
						className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
						aria-label="Registrar producto"
						title="Registrar producto"
					>
						+
					</button>

					<button
						type="button"
						onClick={props.onOpenExport}
						className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Exportar
					</button>
				</div>
			</div>

			{props.filterChips.length > 0 && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{props.filterChips.map((chip) => (
						<span
							key={chip.key}
							className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
						>
							{chip.label}
							<button
								type="button"
								onClick={() => props.onRemoveChip(chip.key)}
								className="rounded-full px-1 text-slate-500 hover:text-slate-900"
								aria-label="Remover filtro"
							>
								×
							</button>
						</span>
					))}
					<button
						type="button"
						onClick={props.onClearAllFilters}
						className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Limpiar todo
					</button>
				</div>
			)}
		</div>
	)
}
