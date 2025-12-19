"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Clock, CreditCard, Eye, Loader2, PiggyBank, ShieldAlert, TrendingUp } from "lucide-react"

import { api } from "../../lib/apiClient"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { useAuthUser } from "../../lib/hooks/useAuthUser"

type ClienteMini = {
  id_cliente: number
  nombres: string
  apellidos: string
  cedula: string
}

type CuotaRecord = {
  id_cuota: number
  numero_cuota: number
  fecha_vencimiento: string
  monto_cuota: number
  monto_pagado: number
  estado_cuota: string
  fecha_pago: string | null
}

type CreditoRecord = {
  id_credito: number
  id_factura: number
  monto_total: number
  saldo_pendiente: number
  fecha_inicio: string
  fecha_fin: string | null
  id_estado: number
  factura: {
    id_factura: number
    numero_factura: string
    total: number
    cliente: ClienteMini | null
  } | null
  cuota: CuotaRecord[]
}

type SelectedCuotaState = CuotaRecord & {
  creditoLabel: string
  clienteLabel: string
}

type PagoFormValues = {
  monto_pago: number
}

// Formateamos todo a USD para que cada tarjeta y tabla hable el mismo idioma.
const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

// Todas las fechas se presentan con el mismo tono humano para evitar confusiones.
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
})

// Badges de estado listos para pintar el tono emocional de cada crédito.
const creditStatusClasses: Record<string, string> = {
  ACTIVO: "bg-blue-50 text-blue-700",
  EN_MORA: "bg-red-100 text-red-700",
  LIQUIDADO: "bg-emerald-50 text-emerald-700",
}

// Reutilizamos la misma escala cromática para que cada cuota sea legible de inmediato.
const cuotaStatusClasses: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PARCIAL: "bg-blue-100 text-blue-800",
  PAGADA: "bg-emerald-100 text-emerald-800",
}

type RawCuota = {
  id_cuota?: number
  numero_cuota?: number
  fecha_vencimiento?: string
  monto_cuota?: unknown
  monto_pagado?: unknown
  estado_cuota?: string
  fecha_pago?: string | null
}

type RawFactura = {
  id_factura?: number
  numero_factura?: string
  total?: unknown
  cliente?: ClienteMini | null
} | null

type RawCredito = {
  id_credito?: number
  id_factura?: number
  monto_total?: unknown
  saldo_pendiente?: unknown
  fecha_inicio?: string
  fecha_fin?: string | null
  id_estado?: number
  factura?: RawFactura
  cuota?: RawCuota[] | null
}

// Algunos endpoints todavía devuelven strings: aquí los hacemos digeribles.
const safeNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Aplanamos la respuesta del backend para que el frontend trabaje con datos coherentes.
const mapCreditoRecord = (rawInput: unknown): CreditoRecord => {
  const raw = (rawInput ?? {}) as RawCredito
  const factura = raw?.factura ?? null
  const cuotas = Array.isArray(raw?.cuota) ? (raw?.cuota as RawCuota[]) : []

  return {
    id_credito: raw?.id_credito ?? 0,
    id_factura: raw?.id_factura ?? 0,
    monto_total: safeNumber(raw?.monto_total),
    saldo_pendiente: safeNumber(raw?.saldo_pendiente),
    fecha_inicio: raw?.fecha_inicio ?? "",
    fecha_fin: raw?.fecha_fin ?? null,
    id_estado: raw?.id_estado ?? 0,
    factura: factura
      ? {
          id_factura: factura.id_factura ?? 0,
          numero_factura: factura.numero_factura ?? `F-${raw?.id_factura ?? ""}`,
          total: safeNumber(factura.total),
          cliente: factura.cliente ?? null,
        }
      : null,
    cuota: cuotas.map((item) => ({
      id_cuota: item.id_cuota ?? 0,
      numero_cuota: item.numero_cuota ?? 0,
      fecha_vencimiento: item.fecha_vencimiento ?? "",
      monto_cuota: safeNumber(item.monto_cuota),
      monto_pagado: safeNumber(item.monto_pagado),
      estado_cuota: item.estado_cuota ?? "PENDIENTE",
      fecha_pago: item.fecha_pago ?? null,
    })),
  }
}

// Siempre mostramos el error real del API antes de caer en un mensaje genérico.
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const err = error as { response?: { data?: { error?: string; message?: string } } }
    return err.response?.data?.error ?? err.response?.data?.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

// El formulario de pago se arma en caliente para bloquear montos que superen el saldo.
const buildPagoSchema = (maxAmount: number) =>
  z.object({
    monto_pago: z
      .number()
      .refine((value) => Number.isFinite(value), { message: "Ingresa un monto válido" })
      .min(0.01, "Monto mínimo 0.01")
      .max(Math.max(maxAmount, 0.01), `No puedes pagar más de ${currency.format(maxAmount)}`),
  })

export default function CreditosPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [selectedCuota, setSelectedCuota] = useState<SelectedCuotaState | null>(null)
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Esta consulta trae el tablero completo y sólo corre si el usuario es admin.
  const creditosQuery = useQuery<CreditoRecord[]>({
    queryKey: ["creditos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<unknown[]>("/credito")
      if (!Array.isArray(data)) return []
      return data.map(mapCreditoRecord)
    },
  })

  // Al abrir el modal cargamos el crédito puntual con todas sus cuotas.
  const creditoDetalleQuery = useQuery<CreditoRecord>({
    queryKey: ["credito", detailId],
    enabled: detailId !== null,
    queryFn: async () => {
      const { data } = await api.get<unknown>(`/credito/${detailId}`)
      if (!data || typeof data !== "object") {
        throw new Error("No se encontró el crédito solicitado")
      }
      return mapCreditoRecord(data)
    },
  })

  const creditos = useMemo(() => creditosQuery.data ?? [], [creditosQuery.data])

  // Métricas rápidas para el header: cuántos créditos siguen vivos y cuánto debemos.
  const activos = useMemo(() => creditos.filter((c) => c.saldo_pendiente > 0.05).length, [creditos])
  const saldoPendienteTotal = useMemo(
    () => creditos.reduce((acc, credito) => acc + credito.saldo_pendiente, 0),
    [creditos]
  )

  // Nos quedamos sólo con cuotas no pagadas para pintar tarjetas y alertas.
  const cuotasPendientes = useMemo(() => {
    return creditos.flatMap((credito) =>
      credito.cuota
        .filter((cuota) => cuota.estado_cuota !== "PAGADA")
        .map((cuota) => ({
          ...cuota,
          creditoId: credito.id_credito,
          facturaNumero: credito.factura?.numero_factura ?? `Crédito #${credito.id_credito}`,
          clienteNombre: credito.factura?.cliente
            ? `${credito.factura.cliente.nombres} ${credito.factura.cliente.apellidos}`
            : "Cliente no disponible",
        }))
    )
  }, [creditos])

  const cuotasVencidas = useMemo(() => {
    const now = Date.now()
    return cuotasPendientes.filter((cuota) => new Date(cuota.fecha_vencimiento).getTime() < now)
  }, [cuotasPendientes])

  // Side card con las siguientes fechas que debemos monitorear.
  const proximasCuotas = useMemo(() => {
    const sorted = [...cuotasPendientes].sort(
      (a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime()
    )
    return sorted.slice(0, 4)
  }, [cuotasPendientes])

  const pendingAmount = selectedCuota
    ? Math.max(selectedCuota.monto_cuota - selectedCuota.monto_pagado, 0)
    : 0

  const pagoSchema = useMemo(() => buildPagoSchema(pendingAmount), [pendingAmount])

  const pagoForm = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: { monto_pago: pendingAmount },
  })

  useEffect(() => {
    if (selectedCuota && pendingAmount > 0) {
      pagoForm.reset({ monto_pago: Number(pendingAmount.toFixed(2)) })
    } else {
      pagoForm.reset({ monto_pago: 0 })
    }
  }, [selectedCuota, pendingAmount, pagoForm])

  // Al confirmar un abono golpeamos el endpoint PATCH /cuota/:id y refrescamos todo.
  const pagarCuotaMutation = useMutation({
    mutationFn: ({ id_cuota, monto_pago }: { id_cuota: number; monto_pago: number }) =>
      api.patch(`/cuota/${id_cuota}`, { monto_pago }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["credito", detailId] })
      }
      setPaymentError(null)
      setPagoDialogOpen(false)
      setSelectedCuota(null)
    },
    onError: (error: unknown) => {
      setPaymentError(getApiErrorMessage(error, "No se pudo registrar el pago"))
    },
  })

  // Enviamos el formulario sólo si hay cuota seleccionada; el resto es UX.
  const onPagoSubmit = pagoForm.handleSubmit((values) => {
    if (!selectedCuota) return
    setPaymentError(null)
    pagarCuotaMutation.mutate({ id_cuota: selectedCuota.id_cuota, monto_pago: values.monto_pago })
  })

  const closeDetailDialog = () => {
    setDetailId(null)
    setSelectedCuota(null)
    setPagoDialogOpen(false)
    setPaymentError(null)
  }

  const handlePagoDialogChange = (open: boolean) => {
    if (!open) {
      setPagoDialogOpen(false)
      setSelectedCuota(null)
      setPaymentError(null)
    } else {
      setPagoDialogOpen(true)
    }
  }

  // Definimos el estado visual del crédito en base al saldo y si arrastra cuotas vencidas.
  const getCreditStatus = (credit: CreditoRecord) => {
    const now = Date.now()
    const hasOverdue = credit.cuota.some((cuota) => {
      if (cuota.estado_cuota === "PAGADA") return false
      return new Date(cuota.fecha_vencimiento).getTime() < now
    })

    if (credit.saldo_pendiente <= 0.01) {
      return { label: "Liquidado", className: creditStatusClasses.LIQUIDADO }
    }
    if (hasOverdue) {
      return { label: "En mora", className: creditStatusClasses.EN_MORA }
    }
    return { label: "Activo", className: creditStatusClasses.ACTIVO }
  }

  const renderSaldo = (valor: number) => (
    <span className={valor > 0 ? "text-slate-900 font-semibold" : "text-emerald-600 font-semibold"}>
      {currency.format(valor)}
    </span>
  )

  // Cualquier usuario sin rol ADMIN ve un mensaje claro en lugar del tablero.
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar créditos y cuotas.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Financiamiento</p>
          <h1 className="text-3xl font-semibold text-slate-900">Créditos y cuotas</h1>
          <p className="mt-1 text-sm text-slate-500">Supervisa saldos pendientes, cuotas vencidas y registra pagos al instante.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Créditos activos</p>
            <CreditCard className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activos}</p>
          <p className="text-sm text-slate-500">Con saldo mayor a 0</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
            <PiggyBank className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{currency.format(saldoPendienteTotal)}</p>
          <p className="text-sm text-slate-500">Incluye capital + intereses</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Cuotas vencidas</p>
            <Clock className="h-5 w-5 text-red-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-600">{cuotasVencidas.length}</p>
          <p className="text-sm text-slate-500">Requieren seguimiento inmediato</p>
        </article>
      </section>

      {creditosQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            {getApiErrorMessage(creditosQuery.error, "No se pudieron cargar los créditos")}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Crédito</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima cuota</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {creditos.map((credito) => {
                  const status = getCreditStatus(credito)
                  const nextCuota = credito.cuota.find((cuota) => cuota.estado_cuota !== "PAGADA")
                  const clienteLabel = credito.factura?.cliente
                    ? `${credito.factura.cliente.nombres} ${credito.factura.cliente.apellidos}`
                    : "Cliente no disponible"

                  return (
                    <tr key={credito.id_credito} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {credito.factura?.numero_factura ?? `Crédito #${credito.id_credito}`}
                        </p>
                        <p className="text-xs text-slate-500">{dateFormatter.format(new Date(credito.fecha_inicio))}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{clienteLabel}</p>
                        <p className="text-xs text-slate-500">{credito.factura?.cliente?.cedula ?? "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{renderSaldo(credito.saldo_pendiente)}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {nextCuota ? (
                          <div>
                            <p className="font-semibold">{currency.format(nextCuota.monto_cuota - nextCuota.monto_pagado)}</p>
                            <p className="text-xs text-slate-500">{dateFormatter.format(new Date(nextCuota.fecha_vencimiento))}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-600">Sin pendientes</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDetailId(credito.id_credito)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {creditosQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando créditos...
            </div>
          )}

          {!creditosQuery.isLoading && creditos.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aún no hay créditos registrados.
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Próximas cuotas</h2>
              <p className="text-sm text-slate-500">Seguimiento de vencimientos más cercanos.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          {proximasCuotas.length === 0 ? (
            <p className="text-sm text-slate-500">No tienes cuotas pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {proximasCuotas.map((cuota) => (
                <li key={cuota.id_cuota} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{cuota.facturaNumero}</p>
                  <p className="text-xs text-slate-500">{cuota.clienteNombre}</p>
                  <p className="text-xs text-slate-500">{dateFormatter.format(new Date(cuota.fecha_vencimiento))}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {currency.format(cuota.monto_cuota - cuota.monto_pagado)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) closeDetailDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de crédito</DialogTitle>
            <DialogDescription>Consulta el saldo, cuotas programadas y registra pagos rápidamente.</DialogDescription>
          </DialogHeader>

          {creditoDetalleQuery.isLoading && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </div>
          )}

          {creditoDetalleQuery.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getApiErrorMessage(creditoDetalleQuery.error, "No se pudo cargar el crédito" )}
            </div>
          )}

          {creditoDetalleQuery.data && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-base font-semibold text-slate-900">
                  {creditoDetalleQuery.data.factura?.numero_factura ?? `Crédito #${creditoDetalleQuery.data.id_credito}`}
                </p>
                <p className="text-sm text-slate-500">
                  Cliente: {creditoDetalleQuery.data.factura?.cliente
                    ? `${creditoDetalleQuery.data.factura.cliente.nombres} ${creditoDetalleQuery.data.factura.cliente.apellidos}`
                    : "No disponible"}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                    <p className="text-xs uppercase text-slate-500">Monto total</p>
                    <p className="text-lg font-semibold text-slate-900">{currency.format(creditoDetalleQuery.data.monto_total)}</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                    <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
                    <p className="text-lg font-semibold text-emerald-700">{currency.format(creditoDetalleQuery.data.saldo_pendiente)}</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                    <p className="text-xs uppercase text-slate-500">Inicio</p>
                    <p className="text-base font-semibold text-slate-900">{dateFormatter.format(new Date(creditoDetalleQuery.data.fecha_inicio))}</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white p-3 text-sm text-slate-600">
                    <p className="text-xs uppercase text-slate-500">Fin</p>
                    <p className="text-base font-semibold text-slate-900">
                      {creditoDetalleQuery.data.fecha_fin
                        ? dateFormatter.format(new Date(creditoDetalleQuery.data.fecha_fin))
                        : "En curso"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Cuota</th>
                        <th className="px-4 py-3 text-left">Vencimiento</th>
                        <th className="px-4 py-3 text-left">Monto</th>
                        <th className="px-4 py-3 text-left">Saldo</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {creditoDetalleQuery.data.cuota.map((cuota) => {
                        const saldoCuota = Math.max(cuota.monto_cuota - cuota.monto_pagado, 0)
                        const cuotaStatus = cuotaStatusClasses[cuota.estado_cuota] ?? "bg-slate-100 text-slate-700"
                        return (
                          <tr key={cuota.id_cuota}>
                            <td className="px-4 py-3 text-slate-700">#{cuota.numero_cuota}</td>
                            <td className="px-4 py-3 text-slate-700">{dateFormatter.format(new Date(cuota.fecha_vencimiento))}</td>
                            <td className="px-4 py-3 text-slate-900 font-semibold">{currency.format(cuota.monto_cuota)}</td>
                            <td className="px-4 py-3 text-slate-900 font-semibold">{currency.format(saldoCuota)}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cuotaStatus}`}>
                                {cuota.estado_cuota === "PAGADA" && cuota.fecha_pago
                                  ? `Pagada · ${dateFormatter.format(new Date(cuota.fecha_pago))}`
                                  : cuota.estado_cuota}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedCuota({
                                    ...cuota,
                                    creditoLabel:
                                      creditoDetalleQuery.data.factura?.numero_factura ?? `Crédito #${creditoDetalleQuery.data.id_credito}`,
                                    clienteLabel: creditoDetalleQuery.data.factura?.cliente
                                      ? `${creditoDetalleQuery.data.factura.cliente.nombres} ${creditoDetalleQuery.data.factura.cliente.apellidos}`
                                      : "Cliente no disponible",
                                  })
                                  setPagoDialogOpen(true)
                                }}
                                disabled={cuota.estado_cuota === "PAGADA" || saldoCuota <= 0 || pagarCuotaMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                              >
                                Registrar pago
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pagoDialogOpen && !!selectedCuota} onOpenChange={handlePagoDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Valida el número de cuota y registra el abono correspondiente.</DialogDescription>
          </DialogHeader>

          {selectedCuota && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedCuota.creditoLabel}</p>
                <p>{selectedCuota.clienteLabel}</p>
                <p className="text-xs text-slate-500">Cuota #{selectedCuota.numero_cuota}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Monto original</span>
                  <strong>{currency.format(selectedCuota.monto_cuota)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Saldo pendiente</span>
                  <strong className="text-emerald-700">{currency.format(pendingAmount)}</strong>
                </div>
              </div>

              {paymentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{paymentError}</div>
              )}

              <form onSubmit={onPagoSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Monto a pagar</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...pagoForm.register("monto_pago", { valueAsNumber: true })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {pagoForm.formState.errors.monto_pago && (
                    <p className="mt-1 text-xs text-red-600">{pagoForm.formState.errors.monto_pago.message}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handlePagoDialogChange(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pagarCuotaMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {pagarCuotaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Registrar pago
                  </button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}