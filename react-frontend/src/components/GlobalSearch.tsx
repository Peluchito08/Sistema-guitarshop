"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Loader2, Package, Search, UserRound, Wallet } from "lucide-react"

import { api } from "../lib/apiClient"
import { appNavItems, type NavItem } from "../lib/navigation"
import { cn } from "../lib/utils"

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

const useDebouncedValue = (value: string, delay = 250) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handler = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(handler)
  }, [value, delay])
  return debounced
}

export const GlobalSearch = () => {
  const navigate = useNavigate()
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

  const handleNavigate = (path: string) => {
    navigate(path)
    closePalette()
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
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar</span>
        <span className="text-xs uppercase text-slate-400">Ctrl + K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
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

            <div className="mt-5 grid gap-6 lg:grid-cols-[2fr,1fr]">
              <div>
                {navResults.length > 0 && (
                  <section>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Atajos</p>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {navResults.map((item: NavItem) => (
                        <li key={item.to}>
                          <button
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                            onClick={() => handleNavigate(item.to)}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="h-4 w-4 text-slate-400" />
                              <span>{item.label}</span>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-slate-400" />
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
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                      <span>Productos ({productResults.length})</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => handleNavigate("/productos")}
                      >
                        Abrir módulo
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
                                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                                isActive
                                  ? "border-slate-900 bg-slate-900/5 text-slate-900"
                                  : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <div>
                                <p className="font-semibold">{producto.nombre_producto}</p>
                                <p className="text-xs text-slate-500">SKU {producto.codigo_producto}</p>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
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
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
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
                          <p className="font-semibold text-slate-900">
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
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
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
                            <div>
                              <p className="font-semibold text-slate-900">Factura {factura.numero_factura}</p>
                              <p className="text-xs text-slate-500">
                                {factura.cliente.nombres} {factura.cliente.apellidos}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{priceFormatter.format(factura.total)}</span>
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

              <aside className="hidden rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:block">
                {previewProduct ? (
                  <div className="space-y-4 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase text-slate-400">Producto</p>
                      <p className="text-lg font-semibold text-slate-900">{previewProduct.nombre_producto}</p>
                      <p className="text-xs text-slate-500">Código {previewProduct.codigo_producto}</p>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-xs uppercase text-slate-400">Precio</p>
                        <p className="text-base font-semibold text-slate-900">{priceFormatter.format(previewProduct.precio_venta)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400">Stock</p>
                        <p className="text-base font-semibold text-slate-900">{previewProduct.cantidad_stock} uds</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                      onClick={() => handleNavigate("/productos")}
                    >
                      <Package className="h-4 w-4" />
                      Abrir módulo de productos
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-3 text-center text-sm text-slate-500">
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
      )}
    </>
  )
}
