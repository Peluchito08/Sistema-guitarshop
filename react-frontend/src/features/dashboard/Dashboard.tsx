"use client"

import { useMemo } from "react"
import { AlertCircle, ArrowDownRight, ArrowUpRight, CreditCard, Package, RefreshCcw, ShieldAlert, ShoppingBag, TrendingUp, Truck, Users, Wallet2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useDashboardData } from "../../lib/hooks/useDashboardData"
import type { CreditStatus, LowStockProduct, SalesHistoryPoint, SalesMetric, TopProduct } from "../../lib/hooks/useDashboardData"
import { cn } from "../../lib/utils"

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 })
const percentFormatter = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1, signDisplay: "always" })
const dateFormatter = new Intl.DateTimeFormat("es-EC", { month: "short", day: "2-digit" })

const formatCurrency = (value: number) => currencyFormatter.format(value)
const formatPercent = (value: number) => `${percentFormatter.format(value)}%`
const formatDateLabel = (iso: string) => dateFormatter.format(new Date(iso))

export default function Dashboard() {
  const { data, isLoading, isRefetching, refetch, error } = useDashboardData()

  const summaryStats = useMemo(() => {
    if (!data) return []
    return [
      { label: "Clientes", value: data.summary.clientes, icon: Users },
      { label: "Productos", value: data.summary.productos, icon: Package },
      { label: "Proveedores", value: data.summary.proveedores, icon: Truck },
      { label: "Compras", value: data.summary.comprasRegistradas, icon: ShoppingBag },
    ]
  }, [data])

  const salesMetrics = useMemo(() => {
    if (!data) return []
    return [
      { label: "Hoy", metric: data.sales.day, context: "vs. ayer" },
      { label: "7 días", metric: data.sales.week, context: "Semana móvil" },
      { label: "Mes", metric: data.sales.month, context: "vs. mes anterior" },
    ]
  }, [data])

  const historyWindow = useMemo(() => {
    if (!data) return []
    return data.salesHistory.slice(-8)
  }, [data])

  const latestPoint = historyWindow[historyWindow.length - 1]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="h-60 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-60 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">No pudimos cargar el dashboard</p>
            <p className="text-sm opacity-80">
              {error instanceof Error ? error.message : "Intenta nuevamente en unos segundos."}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Dirección comercial</p>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Todo el contexto clave en una sola vista.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCcw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          Actualizar
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="col-span-12 lg:col-span-8">
          <SalesPerformanceCard metrics={salesMetrics} total={data.sales.month.amount} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <RevenueCard revenue={data.revenue} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="col-span-12 lg:col-span-7">
          <SalesPulse history={historyWindow} latestValue={latestPoint?.total ?? 0} />
        </div>
        <div className="col-span-12 lg:col-span-5 grid gap-3">
          <AlertPanel
            stockCritico={data.alerts.stockCritico}
            cuotasVencidas={data.alerts.cuotasVencidas}
            montoVencido={data.credits.montoVencido}
            enRiesgo={data.credits.enRiesgo}
          />
          <SummaryPanel stats={summaryStats} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="col-span-12 lg:col-span-7">
          <InventoryPanel products={data.topProducts.slice(0, 4)} lowStock={data.lowStock.slice(0, 4)} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <CreditRiskCard credits={data.credits} />
        </div>
      </section>
    </div>
  )
}

type SalesPerformanceCardProps = {
  metrics: Array<{ label: string; metric: SalesMetric; context: string }>
  total: number
}

const SalesPerformanceCard = ({ metrics, total }: SalesPerformanceCardProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Rendimiento comercial</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(total)}</p>
        <p className="text-[11px] text-slate-500">Mes en curso</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        {metrics.length} ventanas
      </span>
    </div>
    <div className="mt-2.5 grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {metrics.map(({ label, metric, context }) => (
        <div key={label} className="flex flex-col gap-1 px-0 py-2 sm:px-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
            <span>{label}</span>
            <span>{context}</span>
          </div>
          <p className="text-lg font-semibold text-slate-900">{formatCurrency(metric.amount)}</p>
          <p className="text-xs text-slate-500">
            {numberFormatter.format(metric.orders)} facturas · Ticket {formatCurrency(metric.avgTicket)}
          </p>
          <p className={cn("text-xs font-semibold", metric.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatPercent(metric.delta)} vs periodo
          </p>
        </div>
      ))}
    </div>
  </article>
)

type RevenueCardProps = {
  revenue: {
    ingresos: number
    utilidad: number
    margen: number
    delta: number
  }
}

const RevenueCard = ({ revenue }: RevenueCardProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Ingresos vs utilidad</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(revenue.ingresos)}</p>
        <p className="text-[11px] text-slate-500">Margen {(revenue.margen * 100).toFixed(1)}%</p>
      </div>
      <TrendBadge value={revenue.delta} />
    </div>
    <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Wallet2 className="h-4 w-4" />
          Utilidad
        </div>
        <span className="font-semibold text-slate-900">{formatCurrency(revenue.utilidad)}</span>
      </div>
    </div>
  </article>
)

type AlertPanelProps = {
  stockCritico: number
  cuotasVencidas: number
  montoVencido: number
  enRiesgo: number
}

const AlertPanel = ({ stockCritico, cuotasVencidas, montoVencido, enRiesgo }: AlertPanelProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-900">Alertas inmediatas</h2>
    <p className="text-sm text-slate-500">Acciones que requieren seguimiento hoy.</p>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <AlertRow
        label="Stock crítico"
        value={numberFormatter.format(stockCritico)}
        description="Productos por reponer"
        icon={ShoppingBag}
        tone="warning"
      />
      <AlertRow
        label="Cuotas vencidas"
        value={numberFormatter.format(cuotasVencidas)}
        description={`${formatCurrency(montoVencido)} pendientes`}
        icon={CreditCard}
        tone="danger"
      />
      <AlertRow
        label="Créditos en riesgo"
        value={numberFormatter.format(enRiesgo)}
        description="Clientes con atraso"
        icon={ShieldAlert}
        tone="danger"
      />
    </div>
  </article>
)

type AlertRowProps = {
  label: string
  value: string
  description: string
  icon: LucideIcon
  tone: "warning" | "danger"
}

const AlertRow = ({ label, value, description, icon: Icon, tone }: AlertRowProps) => (
  <div
    className={cn(
      "flex items-center justify-between rounded-xl border px-3 py-1.5 text-sm",
      tone === "warning" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
    )}
  >
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
    </div>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
)

type SummaryPanelProps = {
  stats: Array<{ label: string; value: number; icon: LucideIcon }>
}

const SummaryPanel = ({ stats }: SummaryPanelProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-900">Operación</h2>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-slate-100 p-2.5">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <Icon className="h-4 w-4 text-slate-400" />
            {label}
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">{numberFormatter.format(value)}</p>
        </div>
      ))}
    </div>
  </article>
)

type SalesPulseProps = {
  history: SalesHistoryPoint[]
  latestValue: number
}

const SalesPulse = ({ history, latestValue }: SalesPulseProps) => {
  if (history.length === 0) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Aún no hay historial para mostrar.</p>
      </article>
    )
  }

  const totals = history.map((point) => point.total)
  const maxValue = Math.max(...totals, 1)
  const average = totals.reduce((acc, total) => acc + total, 0) / history.length
  const bestDay = history.reduce((prev, current) => (current.total > prev.total ? current : prev))
  const worstDay = history.reduce((prev, current) => (current.total < prev.total ? current : prev))
  const trendPercent = average === 0 ? 0 : ((latestValue - average) / average) * 100

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pulso de ventas</h2>
          <p className="text-sm text-slate-500">Últimos {history.length} días</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-slate-500">Día más reciente</p>
          <p className="text-lg font-semibold text-slate-900">{formatCurrency(latestValue)}</p>
          <p className="text-xs text-slate-500">Promedio {formatCurrency(average)}</p>
        </div>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1.5 border-t border-slate-100 pt-3">
        {history.map((point) => {
          const barHeight = Math.round((point.total / maxValue) * 100)
          return (
            <div key={point.date} className="flex-1">
              <div className="group relative flex h-full flex-col items-center justify-end">
                <div
                  className="w-full rounded-t-lg bg-emerald-500 transition group-hover:bg-emerald-600"
                  style={{ height: `${barHeight}%` }}
                />
                <span className="mt-1 text-[10px] text-slate-500">{formatDateLabel(point.date)}</span>
                <span className="pointer-events-none absolute -top-6 hidden rounded bg-slate-900 px-2 py-0.5 text-[11px] text-white group-hover:block">
                  {formatCurrency(point.total)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2 text-sm text-slate-500 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-400">Mejor día</p>
          <p className="text-base font-semibold text-slate-900">{formatCurrency(bestDay.total)}</p>
          <p className="text-xs">{formatDateLabel(bestDay.date)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Día más lento</p>
          <p className="text-base font-semibold text-slate-900">{formatCurrency(worstDay.total)}</p>
          <p className="text-xs">{formatDateLabel(worstDay.date)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Variación vs promedio</p>
          <p className={cn("text-base font-semibold", trendPercent >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatPercent(trendPercent)}
          </p>
          <p className="text-xs">{trendPercent >= 0 ? "Encima del ritmo habitual" : "Por debajo del ritmo habitual"}</p>
        </div>
      </div>
    </article>
  )
}

type InventoryPanelProps = {
  products: TopProduct[]
  lowStock: LowStockProduct[]
}

const InventoryPanel = ({ products, lowStock }: InventoryPanelProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Inventario</h2>
        <p className="text-sm text-slate-500">Rendimiento y riesgo</p>
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <TrendingUp className="h-5 w-5 text-emerald-500" />
        <ShoppingBag className="h-5 w-5 text-amber-500" />
      </div>
    </div>
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>Top productos</span>
          <span>{products.length}</span>
        </div>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin ventas recientes.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {(() => {
              const topUnits = products.reduce((max, item) => Math.max(max, item.unidades_vendidas), 1)
              return products.map((producto) => {
                const progress = Math.round((producto.unidades_vendidas / topUnits) * 100)
                return (
                  <li key={producto.id_producto}>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{producto.nombre_producto}</p>
                        <p className="text-xs text-slate-500">
                          {numberFormatter.format(producto.unidades_vendidas)} uds · {formatCurrency(producto.ingresos)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{producto.stock_actual} en stock</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                    </div>
                  </li>
                )
              })
            })()}
          </ul>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>Stock crítico</span>
          <span>{lowStock.length}</span>
        </div>
        {lowStock.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Inventario saludable.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {lowStock.map((producto) => {
              const objetivo = producto.stock_minimo || 8
              const porcentaje = Math.min(100, Math.round((producto.cantidad_stock / objetivo) * 100))
              return (
                <li key={producto.id_producto} className="rounded-lg border border-amber-100 bg-amber-50 p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-amber-900">{producto.nombre_producto}</p>
                      <p className="text-xs text-amber-700">SKU {producto.codigo_producto}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      {producto.cantidad_stock} uds
                    </span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${porcentaje}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700">Mínimo {objetivo} uds</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  </article>
)

type CreditRiskCardProps = {
  credits: CreditStatus
}

const CreditRiskCard = ({ credits }: CreditRiskCardProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Riesgo crediticio</h2>
        <p className="text-sm text-slate-500">Saldo vivo y morosidad</p>
      </div>
      <ShieldAlert className="h-5 w-5 text-rose-500" />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-xs uppercase text-slate-500">Créditos activos</p>
        <p className="text-xl font-semibold text-slate-900">{numberFormatter.format(credits.activos)}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-500">Monto pendiente</p>
        <p className="text-base font-semibold text-slate-900">{formatCurrency(credits.montoPendiente)}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-500">En riesgo</p>
        <p className="text-base font-semibold text-rose-600">{numberFormatter.format(credits.enRiesgo)}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-500">Monto vencido</p>
        <p className="text-base font-semibold text-rose-600">{formatCurrency(credits.montoVencido)}</p>
      </div>
    </div>
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs uppercase text-slate-500">
        <span>Cuotas vencidas</span>
        <span>{numberFormatter.format(credits.cuotasVencidas)} pendientes</span>
      </div>
      {credits.detalle.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No hay cuotas vencidas.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {credits.detalle.slice(0, 3).map((detalle) => (
            <li key={detalle.id_cuota} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{detalle.cliente}</p>
                <span className="text-xs font-semibold text-rose-600">{detalle.diasAtraso} días</span>
              </div>
              <p className="text-xs text-slate-500">Factura {detalle.factura}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(detalle.montoPendiente)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  </article>
)

type TrendBadgeProps = {
  value: number
}

const TrendBadge = ({ value }: TrendBadgeProps) => {
  const positive = value >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
      )}
    >
      <Icon className="h-4 w-4" />
      {formatPercent(value)}
    </span>
  )
}