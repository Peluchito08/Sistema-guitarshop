import { useQuery } from "@tanstack/react-query"
import { api } from "../apiClient"

export interface LowStockProduct {
  id_producto: number
  codigo_producto: string
  nombre_producto: string
  cantidad_stock: number
  stock_minimo: number
}

export interface SalesMetric {
  amount: number
  orders: number
  avgTicket: number
  delta: number
}

export interface RevenueSummary {
  ingresos: number
  utilidad: number
  margen: number
  delta: number
}

export interface SalesHistoryPoint {
  date: string
  total: number
}

export interface TopProduct {
  id_producto: number
  nombre_producto: string
  unidades_vendidas: number
  ingresos: number
  stock_actual: number
}

export interface CreditDetail {
  id_cuota: number
  cliente: string
  factura: string
  montoPendiente: number
  diasAtraso: number
}

export interface CreditStatus {
  activos: number
  montoPendiente: number
  enRiesgo: number
  cuotasVencidas: number
  montoVencido: number
  detalle: CreditDetail[]
}

export interface DashboardResponse {
  summary: {
    clientes: number
    productos: number
    proveedores: number
    comprasRegistradas: number
  }
  sales: {
    day: SalesMetric
    week: SalesMetric
    month: SalesMetric
  }
  revenue: RevenueSummary
  salesHistory: SalesHistoryPoint[]
  topProducts: TopProduct[]
  lowStock: LowStockProduct[]
  credits: CreditStatus
  alerts: {
    stockCritico: number
    cuotasVencidas: number
  }
}

async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>("/dashboard")
  return data
}

// Encapsula la consulta del dashboard para reutilizar caché y políticas de refresco.
export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 1000 * 60, // 1 min
    refetchOnWindowFocus: false,
  })
}