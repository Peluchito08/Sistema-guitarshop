"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Loader2, Package, Search, UserRound, Wallet } from "lucide-react"

import { api } from "../lib/apiClient"
import { appNavItems, type NavItem } from "../lib/navigation"
import { cn } from "../lib/utils"
import { useDebouncedValue } from "../lib/hooks/useDebouncedValue"

const searchPlaceholder = "Busca productos, clientes o facturas (Ctrl + K)"
const priceFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" })
const compactPriceFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

type ProductoSearchRecord = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  precio_venta: number
  cantidad_stock: number
}

type ClienteSearchRecord = {
  id_cliente: number
  nombres: string
  apellidos: string
  cedula: string
  telefono: string | null
}

type FacturaSearchRecord = {
  id_factura: number
  numero_factura: string
  fecha_factura: string
  total: number
  forma_pago: string
  cliente: {
    nombres: string
    apellidos: string
  }
}

type SearchResponse = {
  productos: ProductoSearchRecord[]
  clientes: ClienteSearchRecord[]
  facturas: FacturaSearchRecord[]
}

const emptyResults: SearchResponse = {
  productos: [],
  clientes: [],
  facturas: [],
}

export const GlobalSearch = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboardRoute = location.pathname === "/dashboard"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [previewProduct, setPreviewProduct] = useState<ProductoSearchRecord | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const debouncedQuery = useDebouncedValue(query)
  const trimmedQuery = debouncedQuery.trim()
  const shouldSearch = trimmedQuery.length >= 2

  const { data, isFetching, isError } = useQuery<SearchResponse>({
    queryKey: ["global-search", trimmedQuery],
    enabled: open && shouldSearch,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<SearchResponse>("/search", {
        params: { q: trimmedQuery },
      })
      return data ?? emptyResults
    },
  })

  const results = data ?? emptyResults
  const productResults = results.productos
  const clientResults = results.clientes
  const invoiceResults = results.facturas

  const closePalette = () => {
    setOpen(false)
  }

  const handleNavigate = (path: string, options?: { state?: unknown }) => {
    navigate(path, options)
    closePalette()
  }

  const handleOpenProduct = (productId?: number) => {
    if (!productId) return
    handleNavigate("/productos", { state: { focusProductId: productId } })
  }

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 50)
    document.body.style.overflow = "hidden"
    return () => {
      window.clearTimeout(timeout)
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!isDashboardRoute) return

    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
        return
      }
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [isDashboardRoute])

  useEffect(() => {
    if (!isDashboardRoute && open) {
      setOpen(false)
    }
  }, [isDashboardRoute, open])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setPreviewProduct(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (productResults.length === 0) {
      setPreviewProduct(null)
      return
    }
    setPreviewProduct((prev) => {
      if (prev && productResults.some((producto) => producto.id_producto === prev.id_producto)) {
        return prev
      }
      return productResults[0]
    })
  }, [productResults, open])

  const navResults = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return appNavItems.slice(0, 5)
    return appNavItems.filter((item: NavItem) =>
      item.label.toLowerCase().includes(value) || item.to.toLowerCase().includes(value)
    )
  }, [query])

  const hasEntityResults = productResults.length + clientResults.length + invoiceResults.length > 0
  const needsMoreChars = query.trim().length > 0 && query.trim().length < 2
  const showEmptyState = shouldSearch && !isFetching && !hasEntityResults

  return (
    <>
      {isDashboardRoute && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar</span>
          <span className="text-xs uppercase text-slate-400">Ctrl + K</span>
        </button>
      )}

      {isDashboardRoute && open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4 backdrop-blur-sm sm:py-6">
          <div className="flex h-[85vh] w-[min(1100px,92vw)] max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 flex-1 bg-transparent text-sm text-slate-900 outline-none"
              />
              <button
                onClick={closePalette}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium uppercase text-slate-500"
              >
                Esc
              </button>
            </div>

            <div className="mt-5 flex-1 min-h-0 overflow-hidden">
              <div className="grid h-full min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
                {/* Panel izquierdo: atajos + resultados (scrollea) */}
                <div className="min-w-0 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                  {navResults.length > 0 && (
                    <section>
                      <div className="sticky top-0 z-10 bg-white pb-2">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Atajos</p>
                      </div>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {navResults.map((item: NavItem) => (
                          <li key={item.to}>
                            <button
                              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                              onClick={() => handleNavigate(item.to)}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <item.icon className="h-4 w-4 text-slate-400" />
                                <span className="truncate">{item.label}</span>
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                {needsMoreChars && (
                  <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Escribe al menos 2 caracteres para buscar en productos, clientes y facturas.
                  </p>
                )}

                {isFetching && shouldSearch && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando resultados...
                  </div>
                )}

                {isError && (
                  <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    No pudimos completar la búsqueda. Intenta nuevamente.
                  </p>
                )}

                {showEmptyState && (
                  <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No encontramos coincidencias para "{query}".
                  </p>
                )}

                {productResults.length > 0 && (
                  <section className="mt-5">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>Productos ({productResults.length})</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => handleOpenProduct(previewProduct?.id_producto ?? productResults[0]?.id_producto)}
                      >
                        Ir al producto
                      </button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {productResults.map((producto) => {
                        const isActive = previewProduct?.id_producto === producto.id_producto
                        return (
                          <li key={producto.id_producto}>
                            <button
                              type="button"
                              onClick={() => setPreviewProduct(producto)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
                                isActive
                                  ? "border-slate-900 bg-slate-900/5 text-slate-900"
                                  : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="overflow-hidden text-ellipsis font-semibold text-slate-900 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                  {producto.nombre_producto}
                                </p>
                                <p className="text-xs text-slate-500">SKU {producto.codigo_producto}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                                <span>{producto.cantidad_stock} uds</span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold">
                                  {compactPriceFormatter.format(producto.precio_venta)}
                                </span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {clientResults.length > 0 && (
                  <section className="mt-5">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>Clientes ({clientResults.length})</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => handleNavigate("/clientes")}
                      >
                        Ver listado
                      </button>
                    </div>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {clientResults.map((cliente) => (
                        <li key={cliente.id_cliente} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm">
                          <p className="overflow-hidden text-ellipsis font-semibold text-slate-900 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                            {cliente.nombres} {cliente.apellidos}
                          </p>
                          <p className="text-xs text-slate-500">Cédula {cliente.cedula}</p>
                          {cliente.telefono && <p className="text-xs text-slate-500">Tel. {cliente.telefono}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {invoiceResults.length > 0 && (
                  <section className="mt-5">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-2 text-xs uppercase tracking-wide text-slate-400">
                      <span>Facturas ({invoiceResults.length})</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => handleNavigate("/ventas")}
                      >
                        Ir a ventas
                      </button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {invoiceResults.map((factura) => (
                        <li key={factura.id_factura} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">Factura {factura.numero_factura}</p>
                              <p className="overflow-hidden text-ellipsis text-xs text-slate-500 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                {factura.cliente.nombres} {factura.cliente.apellidos}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-slate-900">{priceFormatter.format(factura.total)}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {dateFormatter.format(new Date(factura.fecha_factura))} · {factura.forma_pago}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                </div>

                {/* Panel derecho: ayuda/detalle (scrollea si no alcanza) */}
                <aside className="min-w-0 min-h-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  {previewProduct ? (
                    <div className="space-y-4 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase text-slate-400">Producto</p>
                        <p className="overflow-hidden text-ellipsis text-lg font-semibold text-slate-900 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                          {previewProduct.nombre_producto}
                        </p>
                        <p className="text-xs text-slate-500">Código {previewProduct.codigo_producto}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div>
                          <p className="text-xs uppercase text-slate-400">Precio</p>
                          <p className="text-base font-semibold text-slate-900">
                            {priceFormatter.format(previewProduct.precio_venta)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Stock</p>
                          <p className="text-base font-semibold text-slate-900">{previewProduct.cantidad_stock} uds</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                        onClick={() => handleOpenProduct(previewProduct.id_producto)}
                      >
                        <Package className="h-4 w-4" />
                        Ir al producto
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 text-center text-sm text-slate-500">
                      <UserRound className="h-8 w-8 text-slate-400" />
                      <p>Empieza a escribir para ver sugerencias de inventario, clientes o facturas.</p>
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      <Wallet className="h-4 w-4 text-slate-400" />
                      Tips de búsqueda
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li>• Escribe parte del código de producto o SKU.</li>
                      <li>• Busca clientes por nombre, apellido o cédula.</li>
                      <li>• Ingresa el número de factura para ubicarla rápido.</li>
                    </ul>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
