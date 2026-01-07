import { Search, SlidersHorizontal } from "lucide-react"

export type SalesFilterChip = {
	key: "estado" | "formaPago" | "fecha"
	label: string
}

type Props = {
	startItem: number
	endItem: number
	resultsCount: number

	searchInput: string
	onSearchInputChange: (next: string) => void

	onOpenFilters: () => void

	filterChips: SalesFilterChip[]
	onRemoveChip: (key: SalesFilterChip["key"]) => void
	onClearAllFilters: () => void
}

export function SalesListHeader(props: Props) {
	return (
		<div className="px-6 py-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listado</p>
					<p className="mt-1 text-sm font-semibold text-slate-900">Ventas</p>
					<p className="text-xs text-slate-500">
						Mostrando {props.startItem}-{props.endItem} de {props.resultsCount} resultados.
					</p>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
					<div className="relative w-full flex-1 sm:min-w-[300px] md:min-w-[360px] lg:min-w-[420px]">
						<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
						<input
							value={props.searchInput}
							onChange={(event) => props.onSearchInputChange(event.target.value)}
							placeholder="Buscar por factura, cliente o cédula"
							className="w-full rounded-2xl border border-slate-200 py-2.5 pl-11 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<button
						type="button"
						onClick={props.onOpenFilters}
						className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						<SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
						Filtros
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
