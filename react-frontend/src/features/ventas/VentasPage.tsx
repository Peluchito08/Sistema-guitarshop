"use client"

import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  Eye,
  Loader2,
  NotebookPen,
  PackagePlus,
  Plus,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  XOctagon,
} from "lucide-react"

import { api } from "../../lib/apiClient"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { useAuthUser } from "../../lib/hooks/useAuthUser"

type FormaPago = "CONTADO" | "CREDITO"

type VentaListRecord = {
  id_factura: number
  numero_factura: string
  fecha_factura: string
  forma_pago: FormaPago
  observacion: string | null
  subtotal: number
  impuesto: number
  total: number
  id_estado: number
  cliente: {
    id_cliente: number
    nombres: string
    apellidos: string
    cedula: string
  } | null
  usuario: {
    id_usuario: number
    nombre_completo: string
  } | null
}

type VentaDetailRecord = VentaListRecord & {
  detalle_factura: Array<{
    id_detalle_factura: number
    id_producto: number
    cantidad: number
    precio_unitario: number
    descuento: number
    subtotal: number
    producto: {
      codigo_producto: string
      nombre_producto: string
    }
  }>
  credito: {
    id_credito: number
    monto_total: number
    saldo_pendiente: number
    fecha_inicio: string
    fecha_fin: string | null
    cuota: Array<{
      id_cuota: number
      numero_cuota: number
      fecha_vencimiento: string
      monto_cuota: number
      monto_pagado: number
      estado_cuota: string
    }>
  } | null
}

type ClienteOption = {
  id_cliente: number
  nombres: string
  apellidos: string
  cedula: string
}

type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  precio_venta: number
  cantidad_stock: number
}

// Este shape valida cada línea del carrito antes de golpear al backend.
const detalleSchema = z.object({
  id_producto: z.number().int("Selecciona un producto válido").positive("Selecciona un producto"),
  cantidad: z.number().int("Debe ser entero").min(1, "Cantidad mínima 1"),
  precio_unitario: z.number().min(0.01, "Precio mínimo 0.01"),
  descuento: z.number().min(0, "Descuento inválido").max(999999, "Descuento muy alto").default(0),
})

// Pequeño generador de planes que asegura fechas y número de cuotas razonables.
const creditoSchema = z.object({
  numero_cuotas: z.number().int("Ingresa cuotas").min(1, "Mínimo una cuota").max(48, "Máximo 48 cuotas"),
  fecha_primer_vencimiento: z.string().min(1, "Selecciona la fecha inicial"),
  dias_entre_cuotas: z.number().int("Días inválidos").min(1, "Mínimo 1 día").max(90, "Máximo 90 días"),
})

// Validación completa del formulario, incluido el candado cuando es venta a crédito.
const ventaSchema = z
  .object({
    id_cliente: z.number().int("Cliente inválido").positive("Selecciona un cliente"),
    observacion: z
      .string()
      .trim()
      .max(255, "Máximo 255 caracteres")
      .optional()
      .or(z.literal("")),
    forma_pago: z.enum(["CONTADO", "CREDITO"]),
    detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
    creditoConfig: creditoSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.forma_pago === "CREDITO" && !data.creditoConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["creditoConfig"],
        message: "Configura las cuotas para ventas a crédito",
      })
    }
  })

type VentaFormValues = z.input<typeof ventaSchema>

type VentaPayload = {
  id_cliente: number
  forma_pago: FormaPago
  observacion: string | null
  detalle: Array<{
    id_producto: number
    cantidad: number
    precio_unitario: number
    descuento: number
  }>
  creditoConfig?: {
    numero_cuotas: number
    fecha_primer_vencimiento: string
    dias_entre_cuotas?: number
  }
}

type ApiErrorResponse = {
  error?: string
  message?: string
}

// Estado inicial del wizard para que todo arranque poblado y evitemos undefined.
const defaultValues: VentaFormValues = {
  id_cliente: 0,
  observacion: "",
  forma_pago: "CONTADO",
  detalle: [
    {
      id_producto: 0,
      cantidad: 1,
      precio_unitario: 0,
      descuento: 0,
    },
  ],
  creditoConfig: null,
}

// Usamos USD formateado localmente para subtotales, impuestos y totales.
const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

// Todas las fechas de facturas se leen igual desde la tabla y el modal.
const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
})

const formaPagoLabels: Record<FormaPago, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
}

const formaPagoStyles: Record<FormaPago, string> = {
  CONTADO: "bg-emerald-50 text-emerald-700",
  CREDITO: "bg-purple-50 text-purple-700",
}

const IVA_RATE = 0.15 // 15 % IVA

// Cada petición muestra el mensaje nativo del backend antes de caer en genérico.
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

// Utility para limpiar strings provenientes de inputs numéricos HTML.
const normalizeNumber = (value: unknown) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export default function VentasPage() {
  const { isAdmin } = useAuthUser()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [detailFormError, setDetailFormError] = useState<string | null>(null)
  const [observacionDraft, setObservacionDraft] = useState("")

  // React Hook Form gobierna todo el wizard y se apoya en zodResolver.
  const form = useForm<VentaFormValues>({
    resolver: zodResolver(ventaSchema),
    defaultValues,
  })

  const detalleFieldArray = useFieldArray({ control: form.control, name: "detalle" })
  const detalleValues = useWatch({ control: form.control, name: "detalle" })
  const formaPagoWatch = useWatch({ control: form.control, name: "forma_pago" })

  
  // Tabla principal: trae las ventas más recientes para admins.
  const ventasQuery = useQuery<VentaListRecord[]>({
    queryKey: ["ventas"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<VentaListRecord[]>("/ventas")
      return Array.isArray(data) ? data : []
    },
  })

  // Combo de clientes: se usa en el formulario de creación.
  const clientesQuery = useQuery<ClienteOption[]>({
    queryKey: ["clientes"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<ClienteOption[]>("/cliente")
      return Array.isArray(data) ? data : []
    },
  })

  // Inventario resumido para autocompletar cada detalle.
  const productosQuery = useQuery<ProductoOption[]>({
    queryKey: ["productos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<ProductoOption[]>("/producto")
      if (!Array.isArray(data)) return []
      return data.map((item) => ({
        id_producto: item.id_producto,
        nombre_producto: item.nombre_producto,
        codigo_producto: item.codigo_producto,
        precio_venta: Number(item.precio_venta ?? 0),
        cantidad_stock: Number(item.cantidad_stock ?? 0),
      }))
    },
  })

  // Modal de detalle: reutiliza el mismo id_factura para mostrar creditos/cuotas.
  const ventaDetalleQuery = useQuery<VentaDetailRecord>({
    queryKey: ["venta", detailId],
    enabled: detailId !== null,
    queryFn: async () => {
      const { data } = await api.get<VentaDetailRecord>(`/ventas/${detailId}`)
      return data
    },
  })

  // Cuando abrimos una venta guardamos su observación en un estado editable.
  useEffect(() => {
    if (ventaDetalleQuery.data) {
      setObservacionDraft(ventaDetalleQuery.data.observacion ?? "")
      setDetailFormError(null)
    }
  }, [ventaDetalleQuery.data])

  // Este helper limpia el formulario completo al cerrar el modal de creación.
  const closeCreateDialog = () => {
    form.reset(defaultValues)
    setFormError(null)
    setCreateDialogOpen(false)
  }

  // Convertimos los valores del formulario en la carga útil real para la API.
  const buildPayload = (values: VentaFormValues): VentaPayload => {
    const detalle = values.detalle.map((item) => ({
      id_producto: item.id_producto,
      cantidad: normalizeNumber(item.cantidad) || 0,
      precio_unitario: Number(item.precio_unitario.toFixed(2)),
      descuento: normalizeNumber(item.descuento ?? 0),
    }))

    const payload: VentaPayload = {
      id_cliente: values.id_cliente,
      forma_pago: values.forma_pago,
      observacion: values.observacion?.trim() ? values.observacion.trim() : null,
      detalle,
    }

    if (values.forma_pago === "CREDITO" && values.creditoConfig) {
      payload.creditoConfig = {
        numero_cuotas: values.creditoConfig.numero_cuotas,
        fecha_primer_vencimiento: values.creditoConfig.fecha_primer_vencimiento,
        dias_entre_cuotas: values.creditoConfig.dias_entre_cuotas,
      }
    }

    return payload
  }

  // POST /ventas para crear una factura completa con su crédito opcional.
  const createMutation = useMutation({
    mutationFn: (payload: VentaPayload) => api.post("/ventas", payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      closeCreateDialog()
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error, "No se pudo registrar la venta"))
    },
  })

  // Permite editar sólo la observación sin reabrir la venta.
  const updateObservacionMutation = useMutation({
    mutationFn: ({ id, observacion }: { id: number; observacion: string | null }) =>
      api.put(`/ventas/${id}`, { observacion }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["venta", detailId] })
      }
      setDetailFormError(null)
    },
    onError: (error: unknown) => {
      setDetailFormError(getApiErrorMessage(error, "No se pudo guardar la observación"))
    },
  })

  // Anular una factura hace DELETE y refresca tanto la tabla como el modal.
  const cancelVentaMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ventas/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["venta", detailId] })
      }
      setDetailFormError(null)
    },
    onError: (error: unknown) => {
      setDetailFormError(getApiErrorMessage(error, "No se pudo anular la venta"))
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    createMutation.mutate(buildPayload(values))
  })

  const ventas = useMemo(() => ventasQuery.data ?? [], [ventasQuery.data])
  const clientes = clientesQuery.data ?? []
  const productos = productosQuery.data ?? []

  const productosMap = useMemo(() => {
    const map = new Map<number, ProductoOption>()
    productos.forEach((producto) => {
      map.set(producto.id_producto, producto)
    })
    return map
  }, [productos])


  // Totales en vivo: recalculan subtotal, IVA y total según el detalle.
  const totals = useMemo(() => {
    const items = Array.isArray(detalleValues) ? detalleValues : []
    let subtotal = 0
    items.forEach((item) => {
      const cantidad = normalizeNumber(item?.cantidad)
      const precio = normalizeNumber(item?.precio_unitario)
      const descuento = normalizeNumber(item?.descuento)
      const line = Math.max(cantidad * precio - descuento, 0)
      subtotal += line
    })
    const impuesto = Number((subtotal * IVA_RATE).toFixed(2))
    const total = Number((subtotal + impuesto).toFixed(2))
    return { subtotal, impuesto, total }
  }, [detalleValues])

  // KPIs rápidos para pintar las tarjetas del dashboard.
  const totalFacturado = useMemo(
    () => ventas.reduce((acc, venta) => acc + (venta.total ?? 0), 0),
    [ventas]
  )

  const creditVentas = useMemo(() => ventas.filter((venta) => venta.forma_pago === "CREDITO"), [ventas])
  const creditShare = ventas.length ? Math.round((creditVentas.length / ventas.length) * 100) : 0
  const promedioTicket = ventas.length ? totalFacturado / ventas.length : 0
  const recientes = useMemo(() => ventas.slice(0, 4), [ventas])

  // Cuando seleccionas un producto rellenamos precio y controlamos stock.
  const handleProductSelection = (index: number, productId: number) => {
    if (!productId) return
    const producto = productosMap.get(productId)
    if (producto) {
      form.setValue(`detalle.${index}.precio_unitario`, Number(producto.precio_venta ?? 0), {
        shouldDirty: true,
        shouldValidate: true,
      })
      const cantidadActual = form.getValues(`detalle.${index}.cantidad`)
      if (!cantidadActual || Number.isNaN(cantidadActual) || cantidadActual <= 0) {
        form.setValue(`detalle.${index}.cantidad`, 1, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    }
  }

  const formaPagoField = form.register("forma_pago")

  const handleFormaPagoChange = (event: ChangeEvent<HTMLSelectElement>) => {
    formaPagoField.onChange(event)
    if (event.target.value === "CONTADO") {
      form.setValue("creditoConfig", null)
    } else {
      const current = form.getValues("creditoConfig")
      if (!current) {
        const today = new Date().toISOString().split("T")[0]
        form.setValue("creditoConfig", {
          numero_cuotas: 2,
          fecha_primer_vencimiento: today,
          dias_entre_cuotas: 30,
        })
      }
    }
  }

  const handleCancelVenta = () => {
    if (!ventaDetalleQuery.data || cancelVentaMutation.isPending) return
    const confirmed = window.confirm("¿Seguro que deseas anular esta venta? Esta acción no se puede revertir.")
    if (!confirmed) return
    cancelVentaMutation.mutate(ventaDetalleQuery.data.id_factura)
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Acceso restringido</p>
            <p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar ventas.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Facturación</p>
          <h1 className="text-3xl font-semibold text-slate-900">Ventas</h1>
          <p className="mt-1 text-sm text-slate-500">Controla facturas, observaciones y ventas a crédito en un solo panel.</p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva venta
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase text-slate-500">Ventas registradas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{ventas.length}</p>
          <p className="text-sm text-slate-500">Cabeceras totales en el sistema</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase text-slate-500">Total facturado</p>
          <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-blue-700">
            <BadgeDollarSign className="h-6 w-6 text-blue-400" />
            {currency.format(totalFacturado)}
          </div>
          <p className="text-sm text-slate-500">Incluye IVA</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-slate-500">Créditos</p>
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-purple-700">{creditShare}%</p>
          <p className="text-sm text-slate-500">De las ventas son a crédito</p>
        </article>
      </section>

      {ventasQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Error al cargar ventas. Intenta nuevamente.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Totales</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pago / Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {ventas.map((venta) => {
                  const isAnulada = venta.id_estado !== 1
                  return (
                    <tr key={venta.id_factura} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900">{venta.numero_factura}</p>
                        <p className="text-xs text-slate-500">{dateFormatter.format(new Date(venta.fecha_factura))}</p>
                        {venta.observacion && (
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{venta.observacion}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          {venta.cliente ? `${venta.cliente.nombres} ${venta.cliente.apellidos}` : "Cliente no disponible"}
                        </p>
                        <p className="text-xs text-slate-500">{venta.cliente?.cedula ?? "—"}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <BadgeDollarSign className="h-4 w-4 text-slate-400" />
                          {currency.format(venta.total ?? 0)}
                        </div>
                        <p className="text-xs text-slate-500">
                          Subtotal {currency.format(venta.subtotal ?? 0)} · IVA {currency.format(venta.impuesto ?? 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${formaPagoStyles[venta.forma_pago]}`}>
                          {formaPagoLabels[venta.forma_pago]}
                        </span>
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isAnulada ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isAnulada ? "Anulada" : "Activa"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDetailId(venta.id_factura)}
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

          {ventasQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ventas...
            </div>
          )}

          {!ventasQuery.isLoading && ventas.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <ReceiptText size={36} className="mx-auto mb-2 opacity-50" />
              Aún no registras ventas.
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Movimiento reciente</h2>
              <p className="text-sm text-slate-500">Seguimiento de facturas y crédito.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          {recientes.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos suficientes todavía.</p>
          ) : (
            <ul className="space-y-3">
              {recientes.map((venta) => (
                <li key={venta.id_factura} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{venta.numero_factura}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${formaPagoStyles[venta.forma_pago]}`}>
                      {formaPagoLabels[venta.forma_pago]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{dateFormatter.format(new Date(venta.fecha_factura))}</p>
                  <p className="text-xs text-slate-500">
                    {venta.cliente ? `${venta.cliente.nombres} ${venta.cliente.apellidos}` : "Cliente no disponible"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{currency.format(venta.total ?? 0)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            Ticket promedio {currency.format(promedioTicket)} en las últimas {ventas.length} ventas.
          </div>
        </aside>
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateDialog()
          } else {
            setCreateDialogOpen(true)
          }
        }}
      >
        <DialogContent className="w-full max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle>Registrar venta</DialogTitle>
            <DialogDescription>Observa stock, totales y cuotas sin salir de esta pantalla.</DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}
          <form onSubmit={onSubmit} className="grid max-h-[80vh] grid-cols-1 overflow-hidden lg:grid-cols-[3fr,2fr]">
            <section className="overflow-y-auto px-6 py-5 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Cliente</label>
                  <select
                    {...form.register("id_cliente", { valueAsNumber: true })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={clientesQuery.isLoading}
                  >
                    <option value={0}>Selecciona un cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id_cliente} value={cliente.id_cliente}>
                        {cliente.nombres} {cliente.apellidos} · {cliente.cedula}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.id_cliente && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.id_cliente.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Forma de pago</label>
                  <select
                    {...formaPagoField}
                    onChange={handleFormaPagoChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="CONTADO">Contado</option>
                    <option value="CREDITO">Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-slate-500">Observaciones</label>
                <textarea
                  rows={3}
                  {...form.register("observacion")}
                  placeholder="Ej. Ajustar entrega con el cliente"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {form.formState.errors.observacion && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.observacion.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase text-slate-500">Detalle de productos</label>
                <button
                  type="button"
                  onClick={() => detalleFieldArray.append({ id_producto: 0, cantidad: 1, precio_unitario: 0, descuento: 0 })}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  <PackagePlus className="h-3.5 w-3.5" /> Añadir línea
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {detalleFieldArray.fields.map((field, index) => {
                  const productoField = form.register(`detalle.${index}.id_producto` as const, { valueAsNumber: true })
                  const cantidadField = form.register(`detalle.${index}.cantidad` as const, { valueAsNumber: true })
                  const precioField = form.register(`detalle.${index}.precio_unitario` as const, { valueAsNumber: true })
                  const descuentoField = form.register(`detalle.${index}.descuento` as const, { valueAsNumber: true })
                  const currentLine = detalleValues?.[index]
                  const currentProduct = productosMap.get(currentLine?.id_producto ?? 0)
                  const lineTotal = (() => {
                    const cantidad = normalizeNumber(currentLine?.cantidad)
                    const precio = normalizeNumber(currentLine?.precio_unitario)
                    const descuento = normalizeNumber(currentLine?.descuento)
                    return Math.max(cantidad * precio - descuento, 0)
                  })()

                  return (
                    <div key={field.id} className="space-y-3 rounded-2xl border border-slate-200 p-3">
                      <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
                        <div>
                          <label className="text-[11px] font-medium uppercase text-slate-500">Producto</label>
                          <select
                            {...productoField}
                            onChange={(event) => {
                              productoField.onChange(event)
                              handleProductSelection(index, Number(event.target.value))
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={productosQuery.isLoading}
                          >
                            <option value={0}>Selecciona un producto</option>
                            {productos.map((producto) => (
                              <option key={producto.id_producto} value={producto.id_producto}>
                                {producto.nombre_producto} · {producto.codigo_producto}
                              </option>
                            ))}
                          </select>
                          {form.formState.errors.detalle?.[index]?.id_producto && (
                            <p className="mt-1 text-xs text-red-600">
                              {form.formState.errors.detalle[index]?.id_producto?.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-[11px] font-medium uppercase text-slate-500">Precio unitario</label>
                          <input
                            type="number"
                            step="0.01"
                            {...precioField}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {form.formState.errors.detalle?.[index]?.precio_unitario && (
                            <p className="mt-1 text-xs text-red-600">
                              {form.formState.errors.detalle[index]?.precio_unitario?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-[11px] font-medium uppercase text-slate-500">Cantidad</label>
                          <input
                            type="number"
                            step={1}
                            min={1}
                            {...cantidadField}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {form.formState.errors.detalle?.[index]?.cantidad && (
                            <p className="mt-1 text-xs text-red-600">
                              {form.formState.errors.detalle[index]?.cantidad?.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-[11px] font-medium uppercase text-slate-500">Descuento</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            {...descuentoField}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {form.formState.errors.detalle?.[index]?.descuento && (
                            <p className="mt-1 text-xs text-red-600">
                              {form.formState.errors.detalle[index]?.descuento?.message}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="text-xs text-slate-500">Total línea</p>
                          <p className="text-lg font-semibold text-slate-900">{currency.format(lineTotal)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <p>
                          Stock disponible: {currentProduct ? `${currentProduct.cantidad_stock} und` : "—"}
                        </p>
                        <button
                          type="button"
                          onClick={() => detalleFieldArray.remove(index)}
                          disabled={detalleFieldArray.fields.length === 1}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300 disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {form.formState.errors.detalle?.message && (
                <p className="text-xs text-red-600">{form.formState.errors.detalle.message}</p>
              )}
            </section>

            <aside className="flex flex-col border-t border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-700 lg:border-l lg:border-t-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{currency.format(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>IVA (15 %)</span>
                  <span>{currency.format(totals.impuesto)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{currency.format(totals.total)}</span>
                </div>
              </div>

              {formaPagoWatch === "CREDITO" && (
                <div className="mt-4 space-y-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-slate-700">
                  <p className="text-sm font-semibold text-purple-900">Configuración de crédito</p>
                  <div>
                    <label className="text-[11px] font-medium uppercase text-purple-700">Número de cuotas</label>
                    <input
                      type="number"
                      min={1}
                      {...form.register("creditoConfig.numero_cuotas" as const, { valueAsNumber: true })}
                      className="mt-1 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase text-purple-700">Fecha primer vencimiento</label>
                    <input
                      type="date"
                      {...form.register("creditoConfig.fecha_primer_vencimiento" as const)}
                      className="mt-1 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase text-purple-700">Días entre cuotas</label>
                    <input
                      type="number"
                      min={1}
                      {...form.register("creditoConfig.dias_entre_cuotas" as const, { valueAsNumber: true })}
                      className="mt-1 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  {form.formState.errors.creditoConfig && (
                    <p className="text-xs text-red-600">{form.formState.errors.creditoConfig.message ?? "Completa los campos del crédito"}</p>
                  )}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-slate-400" />
                  Totales calculados automáticamente con IVA al 15 %.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-4">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Registrar venta
                </button>
                <button
                  type="button"
                  onClick={closeCreateDialog}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </aside>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setDetailFormError(null)
            setObservacionDraft("")
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
            <DialogDescription>Incluye cabecera, productos y seguimiento del crédito.</DialogDescription>
          </DialogHeader>

          {ventaDetalleQuery.isLoading && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle...
            </div>
          )}

          {ventaDetalleQuery.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No se pudo cargar el detalle. Intenta nuevamente.
            </div>
          )}

          {ventaDetalleQuery.data && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{ventaDetalleQuery.data.numero_factura}</p>
                    <p className="text-xs text-slate-500">
                      {dateFormatter.format(new Date(ventaDetalleQuery.data.fecha_factura))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${formaPagoStyles[ventaDetalleQuery.data.forma_pago]}`}>
                      {formaPagoLabels[ventaDetalleQuery.data.forma_pago]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ventaDetalleQuery.data.id_estado === 1 ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {ventaDetalleQuery.data.id_estado === 1 ? "Activa" : "Anulada"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Cliente: {ventaDetalleQuery.data.cliente ? `${ventaDetalleQuery.data.cliente.nombres} ${ventaDetalleQuery.data.cliente.apellidos}` : "—"}
                </p>
                <p className="text-sm text-slate-700">
                  Registrada por: {ventaDetalleQuery.data.usuario?.nombre_completo ?? "—"}
                </p>
                {ventaDetalleQuery.data.observacion && (
                  <p className="text-sm text-slate-500">{ventaDetalleQuery.data.observacion}</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Producto</th>
                        <th className="px-4 py-3 text-left">Cantidad</th>
                        <th className="px-4 py-3 text-left">Precio unitario</th>
                        <th className="px-4 py-3 text-left">Descuento</th>
                        <th className="px-4 py-3 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {ventaDetalleQuery.data.detalle_factura.map((detalle) => (
                        <tr key={detalle.id_detalle_factura}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{detalle.producto?.nombre_producto}</p>
                            <p className="text-xs text-slate-500">{detalle.producto?.codigo_producto}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{detalle.cantidad}</td>
                          <td className="px-4 py-3 text-slate-700">{currency.format(detalle.precio_unitario)}</td>
                          <td className="px-4 py-3 text-slate-700">{currency.format(detalle.descuento)}</td>
                          <td className="px-4 py-3 text-slate-900 font-semibold">{currency.format(detalle.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{currency.format(ventaDetalleQuery.data.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>IVA (15 %)</span>
                  <span>{currency.format(ventaDetalleQuery.data.impuesto)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{currency.format(ventaDetalleQuery.data.total)}</span>
                </div>
              </div>

              {ventaDetalleQuery.data.credito && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Crédito #{ventaDetalleQuery.data.credito.id_credito}</p>
                    <CreditCard className="h-4 w-4 text-purple-600" />
                  </div>
                  <p>Monto total: {currency.format(ventaDetalleQuery.data.credito.monto_total)}</p>
                  <p>Saldo pendiente: {currency.format(ventaDetalleQuery.data.credito.saldo_pendiente)}</p>
                  <div className="mt-3 space-y-2 rounded-xl bg-white/70 p-3 text-purple-800">
                    {ventaDetalleQuery.data.credito.cuota.map((cuota) => (
                      <div key={cuota.id_cuota} className="flex items-center justify-between text-xs">
                        <span>
                          Cuota {cuota.numero_cuota} · {dateFormatter.format(new Date(cuota.fecha_vencimiento))}
                        </span>
                        <span className="font-semibold">{currency.format(cuota.monto_cuota)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <NotebookPen className="h-4 w-4 text-slate-500" />
                  Actualizar observaciones
                </div>
                <textarea
                  rows={3}
                  value={observacionDraft}
                  onChange={(event) => setObservacionDraft(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateObservacionMutation.mutate({
                        id: ventaDetalleQuery.data.id_factura,
                        observacion: observacionDraft.trim() ? observacionDraft.trim() : null,
                      })
                    }
                    disabled={
                      updateObservacionMutation.isPending ||
                      observacionDraft.trim() === (ventaDetalleQuery.data.observacion ?? "")
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {updateObservacionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Guardar observación
                  </button>
                  <button
                    type="button"
                    onClick={() => setObservacionDraft(ventaDetalleQuery.data?.observacion ?? "")}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelVenta}
                    disabled={ventaDetalleQuery.data.id_estado !== 1 || cancelVentaMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                  >
                    {cancelVentaMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XOctagon className="h-3.5 w-3.5" />
                    )}
                    Anular venta
                  </button>
                </div>
                {detailFormError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{detailFormError}</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}