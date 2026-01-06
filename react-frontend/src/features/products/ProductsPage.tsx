"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { isAxiosError } from "axios"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useIsFetching, useMutation, useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import {
	AlertCircle,
	Boxes,
	Image as ImageIcon,
	Loader2,
	Package,
	Pencil,
	Plus,
	ShieldAlert,
	Trash2,
	UploadCloud,
} from "lucide-react"
import * as XLSX from "xlsx"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../components/ui/drawer"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue"
import {
	getCategoryPrefix,
	matchCategoryValue,
	productCategories,
	type ProductCategoryValue,
} from "../../config/productCategories"

import type { ProductsFilters, ProductsViewMode } from "./product.types"
import type { ProductoPayload, ProductoRecord, ProductSalesSummary, ProveedorRecord } from "./product.types"
import { productClient } from "./product.client"
import {
	computeMargin,
	computeMarginPercent,
	marginStatusLabel,
	marginStatusWeight,
	matchesMarginFilter,
	matchesSalesFilter,
	matchesStockFilter,
	productStockStatusLabel,
	resolveStockStatus,
	resolveMarginStatus,
	resolveProductStockStatus,
	resolveSalesStatus,
	stockStatusLabel,
	salesStatusLabel,
	salesStatusWeight,
	stockStatusWeight,
} from "./product.utils"
import {
	productsQueryKey,
	useKardexQuery,
	useProductImagesQuery,
	useProductSalesSummaryQuery,
	useProductsQuery,
	useProvidersQuery,
} from "./useProductsQuery"
import { exportToCSV, exportToPDF, exportToXLSX, type ExportRow as ExportFileRow } from "./exportProducts"

import { ProductsFiltersDrawer } from "./components/ProductsFiltersDrawer"
import { ProductsListHeader } from "./components/ProductsListHeader"
import { ProductsDetailDrawer } from "./components/ProductsDetailDrawer"

type ModalMode = "single" | "import"

type BulkProductRow = {
	id: string
	categoria: ProductCategoryValue | ""
	codigo: string
	nombre: string
	descripcion: string
	precio_compra: number
	precio_venta: number
	cantidad_stock: number
	stock_minimo: number
	proveedorId: string
}

type BatchProductRow = {
	id: string
	codigo_producto: string
	nombre_producto: string
	precio_venta: number
	precio_compra: number
	cantidad_stock: number
	stock_minimo: number
}

type ImportFieldKey =
	| "codigo_producto"
	| "nombre_producto"
	| "categoria"
	| "descripcion"
	| "precio_compra"
	| "precio_venta"
	| "cantidad_stock"
	| "stock_minimo"
	| "proveedor"

type ImportState = {
	filename: string
	headers: string[]
	rows: Record<string, unknown>[]
	mapping: Record<ImportFieldKey, string | null>
}

type ImportPreviewRow = {
	id: string
	data: BulkProductRow
	issues: string[]
}

type ApiErrorResponse = {
	error?: string
	message?: string
}

const PAGE_SIZE_STORAGE_KEY = "products.pageSize"
const PAGE_SIZE_OPTIONS = [8, 16, 24, 32] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 16

const importFieldConfig: { key: ImportFieldKey; label: string; required: boolean }[] = [
	{ key: "nombre_producto", label: "Nombre", required: true },
	{ key: "categoria", label: "Categoría", required: true },
	{ key: "precio_venta", label: "Precio de venta", required: true },
	{ key: "cantidad_stock", label: "Stock", required: true },
	{ key: "proveedor", label: "Proveedor", required: true },
	{ key: "precio_compra", label: "Precio de compra", required: false },
	{ key: "stock_minimo", label: "Stock mínimo", required: false },
	{ key: "descripcion", label: "Descripción", required: false },
	{ key: "codigo_producto", label: "Código (opcional)", required: false },
]

const productoSchema = z.object({
	categoria: z.string().min(1, "Selecciona una categoría"),
	codigo_producto: z.string().trim().min(1, "El código es obligatorio").max(30, "Máximo 30 caracteres"),
	nombre_producto: z.string().trim().min(1, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
	descripcion: z
		.string()
		.trim()
		.max(255, "Máximo 255 caracteres")
		.or(z.literal("")),
	imagen_url: z
		.string()
		.trim()
		.max(255, "Máximo 255 caracteres"),
	precio_compra: z.number().nonnegative("No puede ser negativo"),
	precio_venta: z.number().nonnegative("No puede ser negativo"),
	cantidad_stock: z.number().int("Debe ser entero").min(0, "No puede ser negativo"),
	stock_minimo: z.number().int("Debe ser entero").min(0, "No puede ser negativo"),
	id_proveedor: z
		.string()
		.min(1, "Selecciona un proveedor")
		.refine((value) => {
			const parsed = Number(value)
			return Number.isInteger(parsed) && parsed > 0
		}, "Selecciona un proveedor válido"),
})

// Schema del formulario (modal) con numéricos como string mientras el usuario escribe.
// La conversión y validación numérica se hace únicamente al guardar (onSubmit).
const productoFormSchema = productoSchema
	.omit({ precio_compra: true, precio_venta: true, cantidad_stock: true, stock_minimo: true })
	.extend({
		precio_compra: z.string(),
		precio_venta: z.string(),
		cantidad_stock: z.string(),
		stock_minimo: z.string(),
	})

const bulkProductoSchema = productoSchema.extend({
	codigo_producto: z.string().trim().max(30, "Máximo 30 caracteres").or(z.literal("")),
})

type ProductoModalFormValues = z.infer<typeof productoFormSchema>

const currency = new Intl.NumberFormat("es-EC", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
	dateStyle: "medium",
	timeStyle: "short",
})

const defaultValues: ProductoModalFormValues = {
	categoria: "",
	codigo_producto: "",
	nombre_producto: "",
	descripcion: "",
	imagen_url: "",
	precio_compra: "0",
	precio_venta: "0",
	cantidad_stock: "0",
	stock_minimo: "0",
	id_proveedor: "",
}

const generateRowId = () =>
	typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createBlankBatchRow = (): BatchProductRow => ({
	id: generateRowId(),
	codigo_producto: "",
	nombre_producto: "",
	precio_venta: 0,
	precio_compra: 0,
	cantidad_stock: 0,
	stock_minimo: 0,
})

const normalizeNumber = (value: unknown) => {
	if (typeof value === "number") return value
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value)
		return Number.isNaN(parsed) ? 0 : parsed
	}
	return 0
}

const inferCategoryFromCode = (code: string) => {
	const match = code?.toUpperCase().match(/^([A-Z]{3})-/)
	if (!match) return null
	return matchCategoryValue(match[1])
}

const buildNextCode = (prefix: string, takenCodes: Set<string>) => {
	const pattern = new RegExp(`^${prefix}-(\\d{3,})$`, "i")
	let max = 0
	takenCodes.forEach((code) => {
		const match = code.toUpperCase().match(pattern)
		if (match) {
			max = Math.max(max, Number(match[1]))
		}
	})
	let next = max + 1
	let candidate = `${prefix}-${String(next).padStart(3, "0")}`
	while (takenCodes.has(candidate.toUpperCase())) {
		next += 1
		candidate = `${prefix}-${String(next).padStart(3, "0")}`
	}
	return candidate
}

const compressImageFile = (file: File, targetSize = 160) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const image = new Image()
			image.onload = () => {
				const canvas = document.createElement("canvas")
				const ctx = canvas.getContext("2d")
				if (!ctx) {
					reject(new Error("No se pudo preparar el lienzo"))
					return
				}
				const scale = Math.min(targetSize / image.width, targetSize / image.height, 1)
				canvas.width = Math.max(1, Math.round(image.width * scale))
				canvas.height = Math.max(1, Math.round(image.height * scale))
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
				resolve(canvas.toDataURL("image/webp", 0.7))
			}
			image.onerror = () => reject(new Error("Archivo de imagen inválido"))
			image.src = reader.result as string
		}
		reader.onerror = () => reject(new Error("No se pudo leer la imagen"))
		reader.readAsDataURL(file)
	})

const getApiErrorMessage = (error: unknown, fallback: string) => {
	if (isAxiosError<ApiErrorResponse>(error)) {
		return error.response?.data?.error ?? error.response?.data?.message ?? fallback
	}
	if (error instanceof Error) {
		return error.message
	}
	return fallback
}

const normalizeColumnLabel = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[_-]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()

const collapseLabel = (value: string) => value.replace(/\s+/g, "")

const guessColumnKey = (headers: string[], keywords: string[]) => {
	const normalizedKeywords = keywords
		.map((word) => normalizeColumnLabel(word))
		.filter((word) => word.length > 0)
	const collapsedKeywords = normalizedKeywords.map((word) => collapseLabel(word))
	return (
		headers.find((header) => {
			const normalizedHeader = normalizeColumnLabel(header)
			if (!normalizedHeader) return false
			const collapsedHeader = collapseLabel(normalizedHeader)
			return (
				normalizedKeywords.some((keyword) => normalizedHeader.includes(keyword)) ||
				collapsedKeywords.some((keyword) => collapsedHeader.includes(keyword))
			)
		}) ?? null
	)
}

const resolveProveedorId = (value: string, proveedores: ProveedorRecord[]) => {
	const normalized = value.trim().toLowerCase()
	if (!normalized) return null
	const byId = proveedores.find((prov) => String(prov.id_proveedor) === value.trim())
	if (byId) return byId.id_proveedor
	const byName = proveedores.find((prov) => prov.nombre_proveedor.toLowerCase() === normalized)
	return byName?.id_proveedor ?? null
}

type ExportScope = "page" | "filtered" | "all"

type ProductExportRow = {
	Código: string
	Categoría: string
	Nombre: string
	Proveedor: string
	Venta: string
	Compra: string
	Margen: string
	StockActual: string
	StockMinimo: string
	Estado: string
	Ventas30d: string
}

const formatMoney = (value: number | null | undefined) => {
	if (value === null || value === undefined) return "—"
	const numeric = Number(value)
	if (!Number.isFinite(numeric)) return "—"
	return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
}

const formatCell = (value: unknown) => {
	if (value === null || value === undefined) return "—"
	if (typeof value === "string") return value.trim() ? value : "—"
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—"
	return String(value)
}

const buildExportRows = (records: ProductoRecord[], getSalesSummary: (idProducto: number) => ProductSalesSummary | null) =>
	records.map<ProductExportRow>((producto) => {
		const venta = Number(producto.precio_venta ?? 0)
		const compraNumber = Number(producto.precio_compra ?? 0)
		const hasCompra = Number.isFinite(compraNumber) && compraNumber > 0
		const margen = hasCompra ? venta - compraNumber : null

		const stockStatus = resolveProductStockStatus(producto)
		const marginStatus = resolveMarginStatus(producto)
		const summary = getSalesSummary(producto.id_producto)
		const salesStatus = resolveSalesStatus(summary)

		const estadoParts = [
			`Stock: ${productStockStatusLabel(stockStatus)}`,
			salesStatus ? `Ventas: ${salesStatusLabel(salesStatus)}` : "Ventas: —",
			`Margen: ${marginStatusLabel(marginStatus)}`,
			!hasCompra ? "Compra: Sin costo" : null,
		].filter(Boolean)

		return {
			Código: formatCell(producto.codigo_producto),
			Categoría: formatCell(inferCategoryFromCode(producto.codigo_producto)?.toUpperCase() ?? "N/D"),
			Nombre: formatCell(producto.nombre_producto),
			Proveedor: formatCell(producto.proveedor?.nombre_proveedor ?? "Sin proveedor"),
			Venta: formatMoney(venta),
			Compra: hasCompra ? formatMoney(compraNumber) : "—",
			Margen: margen === null ? "—" : formatMoney(margen),
			StockActual: formatCell(Number(producto.cantidad_stock ?? 0)),
			StockMinimo: formatCell(Number(producto.stock_minimo ?? 0)),
			Estado: estadoParts.join(" | "),
			Ventas30d: summary ? formatCell(summary.last30DaysUnitsSold) : "—",
		}
	})

const formatDateStamp = () =>
	new Date()
		.toISOString()
		.replace(/:/g, "-")
		.replace("T", "_")
		.slice(0, 16)

const useFloatingMenu = () => {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!open) return

		const handleMouseDown = (event: MouseEvent) => {
			const target = event.target
			if (!(target instanceof Node)) return
			if (ref.current && ref.current.contains(target)) return
			setOpen(false)
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false)
			}
		}

		document.addEventListener("mousedown", handleMouseDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("mousedown", handleMouseDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

	return { open, setOpen, ref }
}

export default function ProductsPage() {
	const { isAdmin } = useAuthUser()
	const queryClient = useQueryClient()
	const salesQueriesVersion = useIsFetching({ queryKey: ["producto-ventas"] })
	const navigate = useNavigate()
	const location = useLocation()
	const [dialogOpen, setDialogOpen] = useState(false)
	const [modalMode, setModalMode] = useState<ModalMode>("single")
	const [editingProduct, setEditingProduct] = useState<ProductoRecord | null>(null)
	const [formError, setFormError] = useState<string | null>(null)
	const [detailOpen, setDetailOpen] = useState(false)
	const [detailProduct, setDetailProduct] = useState<ProductoRecord | null>(null)
	const [batchSubmitting, setBatchSubmitting] = useState(false)
	const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
		try {
			const raw = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
			const parsed = Number(raw)
			return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as PageSizeOption) : DEFAULT_PAGE_SIZE
		} catch {
			return DEFAULT_PAGE_SIZE
		}
	})
	const handleChangePageSize = (next: number) => {
		if (!(PAGE_SIZE_OPTIONS as readonly number[]).includes(next)) return
		setPageSize(next as PageSizeOption)
		setCurrentPage(1)
	}
	const [batchRows, setBatchRows] = useState<BatchProductRow[]>(() => [createBlankBatchRow()])
	const [batchRowSaveErrors, setBatchRowSaveErrors] = useState<Record<string, string>>({})
	const [dialogExtraTakenCodes, setDialogExtraTakenCodes] = useState<string[]>([])
	const [searchInput, setSearchInput] = useState("")
	const debouncedSearchInput = useDebouncedValue(searchInput, 300)
	const [currentPage, setCurrentPage] = useState(1)
	const defaultFilters = useMemo<ProductsFilters>(
		() => ({
			categoria: "all",
			proveedorId: "all",
			stock: "all",
			sales: "all",
			margin: "all",
			orden: "recent",
		}),
		[]
	)
	const [filters, setFilters] = useState<ProductsFilters>(() => ({ ...defaultFilters }))
	const [filtersDraft, setFiltersDraft] = useState<ProductsFilters>(filters)
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [viewMode, setViewMode] = useState<ProductsViewMode>(() => {
		try {
			const stored = window.localStorage.getItem("products:view")
			return stored === "table" || stored === "cards" ? stored : "cards"
		} catch {
			return "cards"
		}
	})
	const [exportDialogOpen, setExportDialogOpen] = useState(false)
	const [exportScope, setExportScope] = useState<ExportScope>("page")
	const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv")
	const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle")
	const [exportError, setExportError] = useState<string | null>(null)
	const [importState, setImportState] = useState<ImportState | null>(null)
	const [importError, setImportError] = useState<string | null>(null)
	const [importSubmitting, setImportSubmitting] = useState(false)
	const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
	const [imageMode, setImageMode] = useState<"url" | "upload">("url")
	const [imageUploadError, setImageUploadError] = useState<string | null>(null)
	const [imageProcessing, setImageProcessing] = useState(false)

	const form = useForm<ProductoModalFormValues>({
		resolver: zodResolver(productoFormSchema),
		defaultValues,
	})

	const watchedCategoria = form.watch("categoria")
	const watchedImageUrl = form.watch("imagen_url")

	const productosQuery = useProductsQuery(isAdmin)
	const proveedoresQuery = useProvidersQuery(isAdmin)
	const imagenesQuery = useProductImagesQuery(isAdmin)

	const saveProductImage = useCallback(
		async (productId: number, value: string | null) => {
			await productClient.saveImage(productId, value)
			queryClient.invalidateQueries({ queryKey: ["productos-imagenes"] })
		},
		[queryClient]
	)

	const closeDialog = () => {
		setDialogOpen(false)
		setEditingProduct(null)
		setFormError(null)
		setBatchSubmitting(false)
		setBatchRows([createBlankBatchRow()])
		setBatchRowSaveErrors({})
		setDialogExtraTakenCodes([])
		setModalMode("single")
		setImportState(null)
		setImportError(null)
		setUploadedPreview(null)
		setImageMode("url")
		setImageUploadError(null)
		setImageProcessing(false)
		form.reset(defaultValues)
	}

	const openCreate = (mode: ModalMode = "single") => {
		setEditingProduct(null)
		setFormError(null)
		setBatchSubmitting(false)
		setBatchRows([createBlankBatchRow()])
		setBatchRowSaveErrors({})
		setDialogExtraTakenCodes([])
		setModalMode(mode)
		setImportState(null)
		setImportError(null)
		setUploadedPreview(null)
		setImageMode("url")
		form.reset(defaultValues)
		setDialogOpen(true)
	}

	const openEdit = (producto: ProductoRecord) => {
		const cachedImage = imagenesQuery.data?.[producto.id_producto] ?? ""
		const inferredCategory = inferCategoryFromCode(producto.codigo_producto)
		setEditingProduct(producto)
		setFormError(null)
		setModalMode("single")
		setUploadedPreview(cachedImage?.startsWith("data:") ? cachedImage : null)
		setImageMode(cachedImage?.startsWith("data:") ? "upload" : "url")
		form.reset({
			categoria: inferredCategory ?? "",
			codigo_producto: producto.codigo_producto,
			nombre_producto: producto.nombre_producto,
			descripcion: producto.descripcion ?? "",
			imagen_url: cachedImage?.startsWith("data:") ? "" : cachedImage ?? "",
			precio_compra: String(producto.precio_compra ?? 0),
			precio_venta: String(producto.precio_venta ?? 0),
			cantidad_stock: String(producto.cantidad_stock ?? 0),
			stock_minimo: String(producto.stock_minimo ?? 0),
			id_proveedor: producto.id_proveedor ? String(producto.id_proveedor) : "",
		})
		setDialogOpen(true)
	}

	const openDetail = (producto: ProductoRecord) => {
		setDetailProduct(producto)
		setDetailOpen(true)
	}

	useEffect(() => {
		try {
			window.localStorage.setItem("products:view", viewMode)
		} catch {
			// ignore
		}
	}, [viewMode])

	useEffect(() => {
		if (!isAdmin) return
		const state = location.state as { focusProductId?: number } | null
		const focusProductId = state?.focusProductId
		if (!focusProductId) return
		const productos = productosQuery.data ?? []
		const match = productos.find((producto) => producto.id_producto === focusProductId)
		if (!match) return
		openDetail(match)
		navigate(location.pathname, { replace: true, state: null })
	}, [isAdmin, location.pathname, location.state, navigate, productosQuery.data])

	const closeDetail = () => {
		setDetailOpen(false)
		setDetailProduct(null)
	}

	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: ProductoPayload; imageUrl: string | null }) =>
			productClient.update(id, payload),
		onSuccess: async (data, variables) => {
			try {
				await saveProductImage(data.id_producto, variables.imageUrl)
			} catch (error) {
				setFormError(getApiErrorMessage(error, "No se pudo guardar la imagen"))
				return
			}
			queryClient.invalidateQueries({ queryKey: ["productos"] })
			closeDialog()
		},
		onError: (error: unknown) => {
			setFormError(getApiErrorMessage(error, "No se pudo actualizar el producto"))
		},
	})

	const deleteMutation = useMutation({
		mutationFn: (id: number) => productClient.remove(id),
		onSuccess: async (_, id) => {
			try {
				await saveProductImage(id, null)
			} catch (error) {
				console.error("No se pudo limpiar la imagen del producto", error)
			}
			queryClient.invalidateQueries({ queryKey: ["productos"] })
		},
	})

	const productSalesQuery = useProductSalesSummaryQuery(
		detailProduct?.id_producto ?? 0,
		isAdmin && detailOpen && Boolean(detailProduct?.id_producto)
	)
	const kardexQuery = useKardexQuery(isAdmin && detailOpen)

	const productos = useMemo(() => productosQuery.data ?? [], [productosQuery.data])
	const proveedores = useMemo(() => proveedoresQuery.data ?? [], [proveedoresQuery.data])
	const getCachedSalesStatus = useCallback(
		(productId: number) => {
			const summary = queryClient.getQueryData<ProductSalesSummary>(["producto-ventas", productId])
			return resolveSalesStatus(summary)
		},
		[queryClient]
	)
	const getCachedSalesSummary = useCallback(
		(productId: number) => {
			return queryClient.getQueryData<ProductSalesSummary>(["producto-ventas", productId]) ?? null
		},
		[queryClient]
	)

	useEffect(() => {
		try {
			window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize))
		} catch {
			// noop
		}
	}, [pageSize])

	const kpiStockCritico = useMemo(() => {
		return productos.filter((p) => {
			const status = resolveProductStockStatus(p)
			return status === "CRITICAL" || status === "SIN_STOCK"
		}).length
	}, [productos])

	const kpiNoSales30d = useMemo(() => {
		return productos.filter((p) => getCachedSalesStatus(p.id_producto) === "NO_SALES_30D").length
	}, [productos, getCachedSalesStatus, salesQueriesVersion])

	const kpiLowMargin = useMemo(() => {
		return productos.filter((p) => resolveMarginStatus(p) === "LOW_MARGIN").length
	}, [productos])
	const proveedoresNoDisponibles = proveedoresQuery.isError
	const noProveedoresDisponibles = !proveedoresQuery.isLoading && !proveedoresNoDisponibles && proveedores.length === 0
	const isMutating = updateMutation.isPending

	const openFilters = () => {
		setFiltersDraft(filters)
		setFiltersOpen(true)
	}

	const applyFilters = () => {
		setFilters(filtersDraft)
		setFiltersOpen(false)
	}

	const clearAllFilters = () => {
		setFilters({ ...defaultFilters })
	}

	const categoryLabel = useMemo(() => {
		if (filters.categoria === "all") return "Todas"
		return productCategories.find((c) => c.value === filters.categoria)?.label ?? "Categoría"
	}, [filters.categoria])

	const providerLabel = useMemo(() => {
		if (filters.proveedorId === "all") return "Todos"
		const match = proveedores.find((p) => p.id_proveedor === filters.proveedorId)
		return match?.nombre_proveedor ?? "Proveedor"
	}, [filters.proveedorId, proveedores])

	const stockLabel = useMemo(() => {
		switch (filters.stock) {
			case "CRITICAL":
				return "Crítico"
			case "LOW":
				return "Bajo"
			case "NORMAL":
				return "Normal"
			case "SIN_STOCK":
				return "Sin stock"
			default:
				return "Todos"
		}
	}, [filters.stock])

	const salesLabel = useMemo(() => {
		switch (filters.sales) {
			case "ACTIVE":
				return "Activas"
			case "NO_SALES_30D":
				return "Sin ventas 30d"
			default:
				return "Todas"
		}
	}, [filters.sales])

	const marginLabel = useMemo(() => {
		switch (filters.margin) {
			case "OK":
				return "OK"
			case "LOW_MARGIN":
				return "Margen bajo"
			case "NO_COST":
				return "Sin costo"
			default:
				return "Todos"
		}
	}, [filters.margin])

	const sortLabel = useMemo(() => {
		switch (filters.orden) {
			case "name_asc":
				return "Nombre A-Z"
			case "name_desc":
				return "Nombre Z-A"
			case "stock_asc":
				return "Stock asc"
			case "stock_desc":
				return "Stock desc"
			case "price_asc":
				return "Precio asc"
			case "price_desc":
				return "Precio desc"
			case "margin_asc":
				return "Margen asc"
			case "margin_desc":
				return "Margen desc"
			case "status_stock":
				return "Estado stock"
			case "status_sales":
				return "Estado ventas"
			case "status_margin":
				return "Estado margen"
			default:
				return "Más recientes"
		}
	}, [filters.orden])

	const filterChips = useMemo(() => {
		const chips: Array<{ key: "categoria" | "proveedor" | "stock" | "sales" | "margin" | "orden"; label: string }> = []
		if (filters.categoria !== "all") chips.push({ key: "categoria", label: `Categoría: ${categoryLabel}` })
		if (filters.proveedorId !== "all") chips.push({ key: "proveedor", label: `Proveedor: ${providerLabel}` })
		if (filters.stock !== "all") chips.push({ key: "stock", label: `Stock: ${stockLabel}` })
		if (filters.sales !== "all") chips.push({ key: "sales", label: `Ventas: ${salesLabel}` })
		if (filters.margin !== "all") chips.push({ key: "margin", label: `Margen: ${marginLabel}` })
		if (filters.orden !== "recent") chips.push({ key: "orden", label: `Ordenar: ${sortLabel}` })
		return chips
	}, [filters, categoryLabel, providerLabel, stockLabel, salesLabel, marginLabel, sortLabel])

	const removeChip = (key: (typeof filterChips)[number]["key"]) => {
		switch (key) {
			case "categoria":
				setFilters((prev) => ({ ...prev, categoria: "all" }))
				break
			case "proveedor":
				setFilters((prev) => ({ ...prev, proveedorId: "all" }))
				break
			case "stock":
				setFilters((prev) => ({ ...prev, stock: "all" }))
				break
			case "sales":
				setFilters((prev) => ({ ...prev, sales: "all" }))
				break
			case "margin":
				setFilters((prev) => ({ ...prev, margin: "all" }))
				break
			case "orden":
				setFilters((prev) => ({ ...prev, orden: "recent" }))
				break
		}
	}

	const urlPreview = useMemo(() => {
		const trimmed = watchedImageUrl?.trim()
		if (!trimmed) return null
		try {
			return new URL(trimmed).toString()
		} catch {
			return null
		}
	}, [watchedImageUrl])

	const resolvedPreview = imageMode === "upload" ? uploadedPreview : urlPreview

	const takenCodes = useMemo(() => {
		const set = new Set<string>()
		productos.forEach((producto) => set.add(producto.codigo_producto.toUpperCase()))
		return set
	}, [productos])

	const dialogTakenCodes = takenCodes
	const dialogEffectiveTakenCodes = useMemo(() => {
		const set = new Set<string>(dialogTakenCodes)
		dialogExtraTakenCodes.forEach((code) => set.add(code.toUpperCase()))
		return set
	}, [dialogTakenCodes, dialogExtraTakenCodes])

	const editingInitialCategory = useMemo(() => (editingProduct ? inferCategoryFromCode(editingProduct.codigo_producto) : null), [editingProduct])

	useEffect(() => {
		if (!dialogOpen) return
		if (!editingProduct) return
		if (!watchedCategoria) return
		const prefix = getCategoryPrefix(watchedCategoria as ProductCategoryValue)
		if (!prefix) return
		const currentCode = form.getValues("codigo_producto")
		if (editingProduct && watchedCategoria === editingInitialCategory && currentCode === editingProduct.codigo_producto) {
			return
		}
		const nextCode = buildNextCode(prefix, new Set(dialogEffectiveTakenCodes))
		form.setValue("codigo_producto", nextCode, { shouldValidate: true })
	}, [dialogOpen, watchedCategoria, form, dialogEffectiveTakenCodes, editingProduct, editingInitialCategory])

	const getBatchRowIssues = useCallback((row: BatchProductRow) => {
		const issues: string[] = []
		if (!row.nombre_producto.trim()) issues.push("Nombre")
		if (!(row.precio_venta > 0)) issues.push("Precio venta")
		if (row.precio_compra < 0) issues.push("Precio compra")
		if (!Number.isInteger(row.cantidad_stock) || row.cantidad_stock < 0) issues.push("Stock")
		if (!Number.isInteger(row.stock_minimo) || row.stock_minimo < 0) issues.push("Stock mínimo")
		return issues
	}, [])

	const batchReadyCount = useMemo(() => {
		return batchRows.filter((row) => getBatchRowIssues(row).length === 0).length
	}, [batchRows, getBatchRowIssues])

	const assignBatchCodes = useCallback(
		(categoria: ProductCategoryValue | "", rows: BatchProductRow[]) => {
			if (!categoria) {
				return rows.map((row) => ({ ...row, codigo_producto: "" }))
			}
			const prefix = getCategoryPrefix(categoria)
			if (!prefix) return rows
			const taken = new Set<string>(dialogEffectiveTakenCodes)
			return rows.map((row) => {
				const codigo = buildNextCode(prefix, taken)
				taken.add(codigo.toUpperCase())
				return { ...row, codigo_producto: codigo }
			})
		},
		[dialogEffectiveTakenCodes]
	)

	useEffect(() => {
		if (!dialogOpen) return
		if (editingProduct) return
		setBatchRows((rows) => assignBatchCodes((watchedCategoria as ProductCategoryValue) ?? "", rows))
	}, [dialogOpen, editingProduct, watchedCategoria, assignBatchCodes])

	const handleBatchFieldChange = (rowId: string, field: keyof Omit<BatchProductRow, "id" | "codigo_producto">, value: string | number) => {
		setBatchRowSaveErrors((prev) => {
			if (!prev[rowId]) return prev
			const copy = { ...prev }
			delete copy[rowId]
			return copy
		})
		setBatchRows((rows) =>
			rows.map((row) => {
				if (row.id !== rowId) return row
				return { ...row, [field]: value }
			})
		)
	}

	const handleBatchSubmit = async () => {
		if (batchSubmitting) return
		setFormError(null)
		setBatchRowSaveErrors({})

		const categoriaRaw = form.getValues("categoria")
		const proveedorRaw = form.getValues("id_proveedor")
		if (!categoriaRaw) {
			form.setError("categoria", { type: "manual", message: "Selecciona una categoría" })
			setFormError("Selecciona una categoría para continuar.")
			return
		}
		if (!proveedorRaw) {
			form.setError("id_proveedor", { type: "manual", message: "Selecciona un proveedor" })
			setFormError("Selecciona un proveedor para continuar.")
			return
		}

		const categoria = categoriaRaw as ProductCategoryValue
		const prefix = getCategoryPrefix(categoria)
		if (!prefix) {
			setFormError("No se pudo generar el prefijo de categoría.")
			return
		}
		const proveedorId = Number(proveedorRaw)
		if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
			form.setError("id_proveedor", { type: "manual", message: "Selecciona un proveedor válido" })
			setFormError("Selecciona un proveedor válido para continuar.")
			return
		}

		const validRows = batchRows.filter((row) => getBatchRowIssues(row).length === 0)
		if (validRows.length === 0) {
			setFormError("Agrega al menos una fila válida para guardar.")
			return
		}

		setBatchSubmitting(true)
		let success = 0
		let failed = 0
		const rowErrors: Record<string, string> = {}
		const localTaken = new Set<string>(dialogEffectiveTakenCodes)
		const createdCodes: string[] = []
		const successfulRowIds = new Set<string>()

		for (const row of validRows) {
			try {
				let codigo = row.codigo_producto
				if (!codigo || localTaken.has(codigo.toUpperCase())) {
					codigo = buildNextCode(prefix, localTaken)
				}
				localTaken.add(codigo.toUpperCase())

				const payload: ProductoPayload = {
					codigo_producto: codigo,
					nombre_producto: row.nombre_producto.trim(),
					descripcion: null,
					id_proveedor: proveedorId,
					precio_compra: row.precio_compra,
					precio_venta: row.precio_venta,
					cantidad_stock: row.cantidad_stock,
					stock_minimo: row.stock_minimo,
				}

				const data = await productClient.create(payload)
				await saveProductImage(data.id_producto, null)
				success += 1
				createdCodes.push(codigo.toUpperCase())
				successfulRowIds.add(row.id)
			} catch (error) {
				failed += 1
				rowErrors[row.id] = getApiErrorMessage(error, "No se pudo guardar esta fila")
			}
		}

		setBatchSubmitting(false)
		queryClient.invalidateQueries({ queryKey: ["productos"] })
		if (createdCodes.length > 0) {
			setDialogExtraTakenCodes((prev) => {
				const set = new Set(prev.map((code) => code.toUpperCase()))
				createdCodes.forEach((code) => set.add(code.toUpperCase()))
				return Array.from(set)
			})
		}
		setBatchRowSaveErrors(rowErrors)
		if (failed > 0) {
			if (successfulRowIds.size > 0) {
				setBatchRows((rows) => {
					const remaining = rows.filter((row) => !successfulRowIds.has(row.id))
					return remaining.length > 0 ? remaining : [createBlankBatchRow()]
				})
			}
			setFormError(`Guardado parcial: ${success} guardados, ${failed} con error.`)
			return
		}
		closeDialog()
	}

	const normalizedSearch = useMemo(() => debouncedSearchInput.trim().toLowerCase(), [debouncedSearchInput])

	const filteredProducts = useMemo(() => {
		let result = productos

		if (normalizedSearch) {
			result = result.filter(
				(producto) =>
					producto.nombre_producto.toLowerCase().includes(normalizedSearch) ||
					producto.codigo_producto.toLowerCase().includes(normalizedSearch)
			)
		}

		if (filters.categoria !== "all") {
			result = result.filter((producto) => inferCategoryFromCode(producto.codigo_producto) === filters.categoria)
		}

		if (filters.proveedorId !== "all") {
			result = result.filter((producto) => producto.id_proveedor === filters.proveedorId)
		}

		result = result.filter((producto) => matchesStockFilter(producto, filters.stock))

		if (filters.sales !== "all") {
			result = result.filter((producto) => matchesSalesFilter(getCachedSalesStatus(producto.id_producto), filters.sales))
		}

		result = result.filter((producto) => matchesMarginFilter(producto, filters.margin))

		const sorted = [...result]
		sorted.sort((a, b) => {
			switch (filters.orden) {
				case "name_asc":
					return a.nombre_producto.localeCompare(b.nombre_producto, "es")
				case "name_desc":
					return b.nombre_producto.localeCompare(a.nombre_producto, "es")
				case "stock_asc":
					return a.cantidad_stock - b.cantidad_stock
				case "stock_desc":
					return b.cantidad_stock - a.cantidad_stock
				case "price_asc":
					return a.precio_venta - b.precio_venta
				case "price_desc":
					return b.precio_venta - a.precio_venta
				case "margin_asc": {
					const ma = computeMarginPercent(a.precio_compra, a.precio_venta)
					const mb = computeMarginPercent(b.precio_compra, b.precio_venta)
					const va = ma === null ? Number.POSITIVE_INFINITY : ma
					const vb = mb === null ? Number.POSITIVE_INFINITY : mb
					return va - vb
				}
				case "margin_desc": {
					const ma = computeMarginPercent(a.precio_compra, a.precio_venta)
					const mb = computeMarginPercent(b.precio_compra, b.precio_venta)
					const va = ma === null ? Number.NEGATIVE_INFINITY : ma
					const vb = mb === null ? Number.NEGATIVE_INFINITY : mb
					return vb - va
				}
				case "status_stock":
					return stockStatusWeight(resolveProductStockStatus(a)) - stockStatusWeight(resolveProductStockStatus(b))
				case "status_sales":
					return salesStatusWeight(getCachedSalesStatus(a.id_producto)) - salesStatusWeight(getCachedSalesStatus(b.id_producto))
				case "status_margin":
					return marginStatusWeight(resolveMarginStatus(a)) - marginStatusWeight(resolveMarginStatus(b))
				case "recent":
				default:
					return b.id_producto - a.id_producto
			}
		})

		return sorted
	}, [productos, normalizedSearch, filters, getCachedSalesStatus, salesQueriesVersion])

	const sortedAllProducts = useMemo(() => {
		const sorted = [...productos]
		sorted.sort((a, b) => {
			switch (filters.orden) {
				case "name_asc":
					return a.nombre_producto.localeCompare(b.nombre_producto, "es")
				case "name_desc":
					return b.nombre_producto.localeCompare(a.nombre_producto, "es")
				case "stock_asc":
					return a.cantidad_stock - b.cantidad_stock
				case "stock_desc":
					return b.cantidad_stock - a.cantidad_stock
				case "price_asc":
					return a.precio_venta - b.precio_venta
				case "price_desc":
					return b.precio_venta - a.precio_venta
				case "margin_asc": {
					const ma = computeMarginPercent(a.precio_compra, a.precio_venta)
					const mb = computeMarginPercent(b.precio_compra, b.precio_venta)
					const va = ma === null ? Number.POSITIVE_INFINITY : ma
					const vb = mb === null ? Number.POSITIVE_INFINITY : mb
					return va - vb
				}
				case "margin_desc": {
					const ma = computeMarginPercent(a.precio_compra, a.precio_venta)
					const mb = computeMarginPercent(b.precio_compra, b.precio_venta)
					const va = ma === null ? Number.NEGATIVE_INFINITY : ma
					const vb = mb === null ? Number.NEGATIVE_INFINITY : mb
					return vb - va
				}
				case "status_stock":
					return stockStatusWeight(resolveProductStockStatus(a)) - stockStatusWeight(resolveProductStockStatus(b))
				case "status_sales":
					return salesStatusWeight(getCachedSalesStatus(a.id_producto)) - salesStatusWeight(getCachedSalesStatus(b.id_producto))
				case "status_margin":
					return marginStatusWeight(resolveMarginStatus(a)) - marginStatusWeight(resolveMarginStatus(b))
				case "recent":
				default:
					return b.id_producto - a.id_producto
			}
		})
		return sorted
	}, [productos, filters.orden, getCachedSalesStatus, salesQueriesVersion])

	const totalPages = useMemo(() => {
		return Math.max(1, Math.ceil(filteredProducts.length / pageSize))
	}, [filteredProducts.length, pageSize])

	useEffect(() => {
		setCurrentPage(1)
	}, [normalizedSearch, filters])

	useEffect(() => {
		setCurrentPage((page) => Math.min(page, totalPages))
	}, [totalPages])

	const startItem = filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
	const endItem = Math.min(currentPage * pageSize, filteredProducts.length)

	const displayedProducts = useMemo(() => {
		const startIndex = (currentPage - 1) * pageSize
		return filteredProducts.slice(startIndex, startIndex + pageSize)
	}, [filteredProducts, currentPage, pageSize])

	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<ProductoRecord | null>(null)

	const handleDelete = (producto: ProductoRecord) => {
		if (deleteMutation.isPending) return
		setDeleteTarget(producto)
		setDeleteConfirmOpen(true)
	}

	const openStockAdjust = (producto: ProductoRecord) => {
		openEdit(producto)
		window.setTimeout(() => {
			form.setFocus("cantidad_stock")
		}, 50)
	}

	const ProductActionsMenu = ({ producto }: { producto: ProductoRecord }) => {
		const menu = useFloatingMenu()
		return (
			<div ref={menu.ref} className="relative">
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						menu.setOpen((prev) => !prev)
					}}
					className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
					aria-label="Acciones"
				>
					⋯
				</button>
				{menu.open && (
					<div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation()
								navigate("/ventas")
								menu.setOpen(false)
							}}
							className="flex w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
						>
							Historial
						</button>
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation()
								handleDelete(producto)
								menu.setOpen(false)
							}}
							disabled={deleteMutation.isPending}
							className="flex w-full px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
						>
							Eliminar
						</button>
					</div>
				)}
			</div>
		)
	}

	const parseNonNegativeFloat = (raw: string) => {
		const normalized = raw.trim()
		if (!normalized) return { ok: false as const, message: "Ingresa un valor" }
		const maybe = normalized.includes(",") && !normalized.includes(".") ? normalized.replace(",", ".") : normalized
		const parsed = parseFloat(maybe)
		if (Number.isNaN(parsed)) return { ok: false as const, message: "Ingresa un número válido" }
		if (parsed < 0) return { ok: false as const, message: "No puede ser negativo" }
		return { ok: true as const, value: parsed }
	}

	const parseNonNegativeInt = (raw: string) => {
		const normalized = raw.trim()
		if (!normalized) return { ok: false as const, message: "Ingresa un valor" }
		if (normalized.includes(".") || normalized.includes(",")) {
			return { ok: false as const, message: "Debe ser entero" }
		}
		const parsed = parseInt(normalized, 10)
		if (Number.isNaN(parsed)) return { ok: false as const, message: "Ingresa un número válido" }
		if (parsed < 0) return { ok: false as const, message: "No puede ser negativo" }
		return { ok: true as const, value: parsed }
	}

	const onSubmit = form.handleSubmit((values) => {
		if (!editingProduct) return
		setFormError(null)
		form.clearErrors(["precio_compra", "precio_venta", "cantidad_stock", "stock_minimo"])

		const precioCompraParsed = parseNonNegativeFloat(values.precio_compra)
		if (!precioCompraParsed.ok) {
			form.setError("precio_compra", { type: "manual", message: precioCompraParsed.message })
			return
		}
		const precioVentaParsed = parseNonNegativeFloat(values.precio_venta)
		if (!precioVentaParsed.ok) {
			form.setError("precio_venta", { type: "manual", message: precioVentaParsed.message })
			return
		}
		const stockParsed = parseNonNegativeInt(values.cantidad_stock)
		if (!stockParsed.ok) {
			form.setError("cantidad_stock", { type: "manual", message: stockParsed.message })
			return
		}
		const stockMinParsed = parseNonNegativeInt(values.stock_minimo)
		if (!stockMinParsed.ok) {
			form.setError("stock_minimo", { type: "manual", message: stockMinParsed.message })
			return
		}

		const imageValue = imageMode === "upload" ? uploadedPreview : values.imagen_url?.trim()
		const proveedorId = Number(values.id_proveedor)

		const payload: ProductoPayload = {
			codigo_producto: values.codigo_producto.trim().toUpperCase(),
			nombre_producto: values.nombre_producto.trim(),
			descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
			id_proveedor: proveedorId,
			precio_compra: precioCompraParsed.value,
			precio_venta: precioVentaParsed.value,
			cantidad_stock: stockParsed.value,
			stock_minimo: stockMinParsed.value,
		}

		updateMutation.mutate({ id: editingProduct.id_producto, payload, imageUrl: imageValue ?? null })
	})

	const getBulkRowIssues = useCallback((row: BulkProductRow) => {
		const parsed = bulkProductoSchema.safeParse({
			categoria: row.categoria,
			codigo_producto: row.codigo,
			nombre_producto: row.nombre,
			descripcion: row.descripcion,
			imagen_url: "",
			precio_compra: row.precio_compra,
			precio_venta: row.precio_venta,
			cantidad_stock: row.cantidad_stock,
			stock_minimo: row.stock_minimo,
			id_proveedor: row.proveedorId,
		})
		if (parsed.success) return []
		const labels = new Set<string>()
		parsed.error.issues.forEach((issue) => {
			const key = issue.path[0]
			switch (key) {
				case "categoria":
					labels.add("Categoría")
					break
				case "nombre_producto":
					labels.add("Nombre")
					break
				case "id_proveedor":
					labels.add("Proveedor")
					break
				case "precio_compra":
					labels.add("Precio compra")
					break
				case "precio_venta":
					labels.add("Precio venta")
					break
				case "cantidad_stock":
					labels.add("Stock")
					break
				case "stock_minimo":
					labels.add("Stock mínimo")
					break
				case "descripcion":
					labels.add("Notas")
					break
				default:
					break
			}
		})
		return Array.from(labels)
	}, [])

	const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return
		setImageUploadError(null)
		setImageProcessing(true)
		try {
			const preview = await compressImageFile(file)
			setUploadedPreview(preview)
			setImageMode("upload")
			form.setValue("imagen_url", "")
		} catch (error) {
			setImageUploadError(getApiErrorMessage(error, "No pudimos preparar la imagen"))
		} finally {
			setImageProcessing(false)
			event.target.value = ""
		}
	}

	const handleImageModeChange = (mode: "url" | "upload") => {
		setImageMode(mode)
		setImageUploadError(null)
		if (mode === "url") {
			setUploadedPreview(null)
		} else {
			form.setValue("imagen_url", "")
		}
	}

	const handleImportFile = async (file: File) => {
		setImportError(null)
		try {
			const buffer = await file.arrayBuffer()
			const workbook = XLSX.read(buffer, { type: "array" })
			const sheet = workbook.Sheets[workbook.SheetNames[0]]
			const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
			if (rows.length === 0) {
				setImportError("El archivo está vacío.")
				return
			}
			const headers = Object.keys(rows[0])
			const mapping: Record<ImportFieldKey, string | null> = {
				nombre_producto: guessColumnKey(headers, ["nombre", "producto"]),
				categoria: guessColumnKey(headers, ["categoria", "tipo"]),
				precio_venta: guessColumnKey(headers, ["precio venta", "pv"]),
				cantidad_stock: guessColumnKey(headers, ["stock", "existencia"]),
				proveedor: guessColumnKey(headers, ["proveedor", "vendor"]),
				precio_compra: guessColumnKey(headers, ["precio compra", "pc"]),
				stock_minimo: guessColumnKey(headers, ["stock minimo", "min"]),
				descripcion: guessColumnKey(headers, ["descripcion", "detalle"]),
				codigo_producto: guessColumnKey(headers, ["codigo", "sku"]),
			}
			setImportState({ filename: file.name, headers, rows, mapping })
			setModalMode("import")
		} catch (error) {
			setImportError(getApiErrorMessage(error, "No pudimos leer el archivo"))
		}
	}

	const resolvedImportRows: ImportPreviewRow[] = useMemo(() => {
		if (!importState) return []
		return importState.rows.map((row) => {
			const categoriaValue = importState.mapping.categoria
				? matchCategoryValue(String(row[importState.mapping.categoria] ?? ""))
				: null
			const proveedorId = importState.mapping.proveedor
				? resolveProveedorId(String(row[importState.mapping.proveedor] ?? ""), proveedores)
				: null
			const codigo = importState.mapping.codigo_producto
				? String(row[importState.mapping.codigo_producto] ?? "").toUpperCase()
				: ""
			const data: BulkProductRow = {
				id: generateRowId(),
				categoria: categoriaValue ?? "",
				codigo,
				nombre: importState.mapping.nombre_producto ? String(row[importState.mapping.nombre_producto] ?? "") : "",
				descripcion: importState.mapping.descripcion ? String(row[importState.mapping.descripcion] ?? "") : "",
				precio_compra: normalizeNumber(importState.mapping.precio_compra ? row[importState.mapping.precio_compra] : 0),
				precio_venta: normalizeNumber(importState.mapping.precio_venta ? row[importState.mapping.precio_venta] : 0),
				cantidad_stock: normalizeNumber(importState.mapping.cantidad_stock ? row[importState.mapping.cantidad_stock] : 0),
				stock_minimo: normalizeNumber(importState.mapping.stock_minimo ? row[importState.mapping.stock_minimo] : 0),
				proveedorId: proveedorId ? String(proveedorId) : "",
			}
			const issues = getBulkRowIssues(data)
			return { id: data.id, data, issues }
		})
	}, [importState, proveedores, getBulkRowIssues])

	const validImportRows = resolvedImportRows.filter((row) => row.issues.length === 0)

	const handleImportConfirm = async () => {
		if (!importState) return
		if (validImportRows.length === 0) {
			setImportError("No hay filas válidas para importar.")
			return
		}
		setImportError(null)
		setImportSubmitting(true)
		let success = 0
		let failed = 0
		const localTaken = new Set(takenCodes)
		for (const row of validImportRows) {
			try {
				const categoria = row.data.categoria as ProductCategoryValue
				const prefix = categoria ? getCategoryPrefix(categoria) : null
				const codigo = row.data.codigo || (prefix ? buildNextCode(prefix, localTaken) : "")
				if (!codigo) throw new Error("No se pudo generar código")
				const payload: ProductoPayload = {
					codigo_producto: codigo,
					nombre_producto: row.data.nombre.trim(),
					descripcion: row.data.descripcion.trim() || null,
					id_proveedor: Number(row.data.proveedorId),
					precio_compra: row.data.precio_compra,
					precio_venta: row.data.precio_venta,
					cantidad_stock: row.data.cantidad_stock,
					stock_minimo: row.data.stock_minimo,
				}
				const data = await productClient.create(payload)
				localTaken.add(codigo.toUpperCase())
				await saveProductImage(data.id_producto, null)
				success += 1
			} catch (error) {
				console.error("Error importando fila", error)
				failed += 1
			}
		}
		setImportSubmitting(false)
		queryClient.invalidateQueries({ queryKey: ["productos"] })
		setImportError(
			failed > 0
				? `Importación finalizada. ${success} productos guardados, ${failed} con errores.`
				: `Importación finalizada. ${success} productos guardados.`
		)
		if (failed === 0) {
			setImportState(null)
			closeDialog()
		}
	}

	const getSourceForExport = async (scope: ExportScope) => {
		if (scope === "page") return displayedProducts
		if (scope === "filtered") return filteredProducts
		// all
		if (productosQuery.data) return sortedAllProducts
		const fetched = await queryClient.fetchQuery({ queryKey: productsQueryKey, queryFn: () => productClient.list() })
		return fetched ?? []
	}

	const runExport = async (): Promise<boolean> => {
		setExportError(null)
		setExportStatus("exporting")
		try {
			const source = await getSourceForExport(exportScope)
			const rows = buildExportRows(source, (id) => getCachedSalesSummary(id))
			const fileRows = rows as unknown as ExportFileRow[]
			if (fileRows.length === 0) {
				setExportError("No hay productos para exportar")
				setExportStatus("idle")
				return false
			}
			const filenameBase = `productos_${exportScope}_${formatDateStamp()}`
			switch (exportFormat) {
				case "csv":
					exportToCSV(fileRows, filenameBase)
					break
				case "xlsx":
					exportToXLSX(fileRows, filenameBase)
					break
				case "pdf":
					exportToPDF(fileRows, filenameBase)
					break
			}
			setExportStatus("done")
			return true
		} catch (error) {
			setExportError(getApiErrorMessage(error, "No se pudo exportar"))
			setExportStatus("error")
			return false
		}
	}

	if (!isAdmin) {
		return (
			<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
				<div className="flex items-center gap-3 text-amber-800">
					<ShieldAlert className="h-5 w-5" />
					<div>
						<p className="font-semibold">Acceso restringido</p>
						<p className="text-sm">Solo usuarios con rol ADMIN pueden administrar productos.</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<section
				aria-labelledby="productos-encabezado"
				className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm"
			>
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p id="productos-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Inventario
						</p>
						<h1 className="mt-1 text-3xl font-semibold text-slate-900">Productos</h1>
						<p className="mt-1 text-sm text-slate-500">Visualiza, crea y actualiza tu catálogo centralizado.</p>
					</div>
					<div className="flex flex-col items-stretch gap-2 sm:items-end">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
						<div className="flex flex-wrap items-center justify-end gap-2">
							<button
								onClick={() => openCreate("single")}
								disabled={noProveedoresDisponibles || proveedoresNoDisponibles}
								className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								<Plus className="h-4 w-4" />
								Registrar productos
							</button>
					</div>
						{proveedoresNoDisponibles ? (
							<p className="text-xs text-amber-700">No se pudieron cargar proveedores. Intenta nuevamente.</p>
						) : noProveedoresDisponibles ? (
							<p className="text-xs text-amber-700">Crea un proveedor para habilitar este módulo.</p>
						) : null}
					</div>
				</div>
			</section>

			<section aria-labelledby="productos-resumen" className="space-y-3">
				<div className="flex items-center justify-between">
					<p id="productos-resumen" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Resumen
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters({ ...defaultFilters })}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters({ ...defaultFilters })
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Total productos</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{productos.length}</p>
						<p className="text-sm text-slate-500">Registrados en inventario</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters((prev) => ({ ...prev, stock: "CRITICAL" }))}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters((prev) => ({ ...prev, stock: "CRITICAL" }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Stock crítico</p>
						<p className="mt-2 text-3xl font-semibold text-amber-600">{kpiStockCritico}</p>
						<p className="text-sm text-slate-500">Incluye sin stock</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters((prev) => ({ ...prev, sales: "NO_SALES_30D" }))}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters((prev) => ({ ...prev, sales: "NO_SALES_30D" }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Sin ventas 30d</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{kpiNoSales30d}</p>
						<p className="text-sm text-slate-500">Según historial disponible</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters((prev) => ({ ...prev, margin: "LOW_MARGIN" }))}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters((prev) => ({ ...prev, margin: "LOW_MARGIN" }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Margen bajo</p>
						<p className="mt-2 text-3xl font-semibold text-amber-600">{kpiLowMargin}</p>
						<p className="text-sm text-slate-500">Bajo umbral por defecto</p>
					</article>
				</div>
			</section>

			{productosQuery.isError && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
					<div className="flex items-center gap-2 font-medium">
						<AlertCircle className="h-4 w-4" />
						Error al cargar datos. Intenta nuevamente.
					</div>
				</div>
			)}


			<section aria-labelledby="productos-listado" className="rounded-2xl border border-slate-200 bg-white">
				<ProductsListHeader
					startItem={startItem}
					endItem={endItem}
					resultsCount={filteredProducts.length}
					searchInput={searchInput}
					onSearchInputChange={setSearchInput}
					onOpenFilters={openFilters}
					viewMode={viewMode}
					onChangeViewMode={setViewMode}
					pageSize={pageSize}
					onChangePageSize={handleChangePageSize}
					onOpenCreate={() => openCreate("single")}
					createDisabled={noProveedoresDisponibles}
					onOpenExport={() => {
						setExportStatus("idle")
						setExportError(null)
						setExportDialogOpen(true)
					}}
					filterChips={filterChips}
					onRemoveChip={removeChip}
					onClearAllFilters={clearAllFilters}
				/>

				<Dialog
					open={exportDialogOpen}
					onOpenChange={(open) => {
						// Bloqueado: solo cerrar con botones del modal.
						if (!open) return
						setExportDialogOpen(true)
					}}
				>
					<DialogContent className="max-w-3xl" disableOutsideClose hideCloseButton>
						<DialogHeader>
							<DialogTitle>Exportar productos</DialogTitle>
							<DialogDescription>Selecciona el alcance y el formato de exportación.</DialogDescription>
						</DialogHeader>

						<div className="grid gap-6 md:grid-cols-2">
							<div className="grid gap-3">
								<p className="text-sm font-semibold text-slate-900">Alcance</p>
								<div className="grid gap-2">
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-scope"
											checked={exportScope === "page"}
											onChange={() => setExportScope("page")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">Página actual</p>
											<p className="text-xs text-slate-500">Lo visible en pantalla según la paginación actual.</p>
										</div>
									</label>
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-scope"
											checked={exportScope === "filtered"}
											onChange={() => setExportScope("filtered")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">Filtrados</p>
											<p className="text-xs text-slate-500">Aplica búsqueda + filtros + orden, sin importar página.</p>
										</div>
									</label>
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-scope"
											checked={exportScope === "all"}
											onChange={() => setExportScope("all")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">Todo</p>
											<p className="text-xs text-slate-500">Ignora filtros y exporta todos los productos.</p>
										</div>
									</label>
								</div>
							</div>

							<div className="grid gap-3">
								<p className="text-sm font-semibold text-slate-900">Formato</p>
								<div className="grid gap-2">
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-format"
											checked={exportFormat === "csv"}
											onChange={() => setExportFormat("csv")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">CSV</p>
											<p className="text-xs text-slate-500">Compatible con Excel (separador ;).</p>
										</div>
									</label>
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-format"
											checked={exportFormat === "xlsx"}
											onChange={() => setExportFormat("xlsx")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">Excel (.xlsx)</p>
											<p className="text-xs text-slate-500">Hoja "Productos" con columnas formateadas.</p>
										</div>
									</label>
									<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
										<input
											type="radio"
											name="export-format"
											checked={exportFormat === "pdf"}
											onChange={() => setExportFormat("pdf")}
											className="mt-1"
										/>
										<div>
											<p className="text-sm font-semibold text-slate-900">PDF</p>
											<p className="text-xs text-slate-500">Tabla en PDF (landscape).</p>
										</div>
									</label>
								</div>
							</div>
						</div>

						{exportError && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exportError}</div>
						)}

						<DialogFooter>
							<button
								type="button"
								onClick={() => {
									if (exportStatus === "exporting") return
									setExportDialogOpen(false)
								}}
								disabled={exportStatus === "exporting"}
								className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={async () => {
									const ok = await runExport()
									if (ok) setExportDialogOpen(false)
								}}
								disabled={exportStatus === "exporting"}
								className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{exportStatus === "exporting" ? "Exportando…" : exportStatus === "done" ? "Listo" : "Aceptar"}
							</button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<div className="hidden px-6 py-4">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p id="productos-listado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Listado
							</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">Productos</p>
							<p className="text-xs text-slate-500">
								Mostrando {startItem}-{endItem} de {filteredProducts.length} resultados.
							</p>
						</div>

						<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
							<input
								value={searchInput}
								onChange={(event) => setSearchInput(event.target.value)}
								placeholder="Buscar por código o nombre"
								className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-72"
							/>

							<button
								type="button"
								onClick={openFilters}
								className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
							>
								Filtros
							</button>

							<div className="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
								<button
									type="button"
									onClick={() => setViewMode("table")}
									className={
										"px-4 py-2.5 text-sm font-semibold transition " +
										(viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")
									}
								>
									Tabla
								</button>
								<button
									type="button"
									onClick={() => setViewMode("cards")}
									className={
										"px-4 py-2.5 text-sm font-semibold transition " +
										(viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")
									}
								>
									Cards
								</button>
							</div>

							<button
								type="button"
								onClick={() => openCreate("single")}
								disabled={noProveedoresDisponibles}
								className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							>
								Registrar
							</button>

							<button
								type="button"
								onClick={() => {
								setExportStatus("idle")
								setExportError(null)
								setExportDialogOpen(true)
							}}
								className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
							>
								Exportar
							</button>
						</div>
					</div>

					{filterChips.length > 0 && (
						<div className="mt-4 flex flex-wrap items-center gap-2">
							{filterChips.map((chip) => (
								<span
									key={chip.key}
									className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
								>
									{chip.label}
									<button
										type="button"
										onClick={() => removeChip(chip.key)}
										className="rounded-full px-1 text-slate-500 hover:text-slate-900"
										aria-label="Remover filtro"
									>
										×
									</button>
								</span>
							))}
							<button
								type="button"
								onClick={clearAllFilters}
								className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
							>
								Limpiar todo
							</button>
						</div>
					)}
				</div>

				<div className="px-6 pb-6">

					{viewMode === "cards" ? (
						<div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
							{displayedProducts.map((producto) => {
								const stockStatus = resolveProductStockStatus(producto)
								const stockStatusText = productStockStatusLabel(stockStatus)
								const salesStatus = getCachedSalesStatus(producto.id_producto)
								const marginStatus = resolveMarginStatus(producto)
								const inferred = inferCategoryFromCode(producto.codigo_producto)
								const purchaseDisplay = producto.precio_compra > 0 ? currency.format(producto.precio_compra) : "—"
								const margin = computeMargin(producto.precio_compra, producto.precio_venta)
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

								return (
									<div
										key={producto.id_producto}
										role="button"
										tabIndex={0}
										aria-label={`Ver detalle de ${producto.nombre_producto}`}
										onClick={() => openDetail(producto)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault()
												openDetail(producto)
											}
									}}
										className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
														{producto.codigo_producto}
													</span>
													<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
														{(inferred ?? "N/D").toUpperCase()}
													</span>
													<span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>{stockStatusText}</span>
													<span className={`rounded-full px-3 py-1 text-xs font-semibold ${salesStatusClass}`}>
														{salesStatus ? salesStatusLabel(salesStatus) : "Ventas: —"}
													</span>
													<span className={`rounded-full px-3 py-1 text-xs font-semibold ${marginStatusClass}`}>{marginStatusLabel(marginStatus)}</span>
												</div>
												<p className="mt-2 truncate text-sm font-semibold text-slate-900">{producto.nombre_producto}</p>
												{producto.descripcion && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{producto.descripcion}</p>}
											</div>
											<div className="shrink-0" onClick={(e) => e.stopPropagation()}>
												<div className="flex items-center gap-1">
													<button
														type="button"
														onClick={() => openEdit(producto)}
														className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
														aria-label="Editar"
													>
														<Pencil className="h-4 w-4" />
													</button>
													<button
														type="button"
														onClick={() => openStockAdjust(producto)}
														className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
														aria-label="Ajustar stock"
													>
														<Boxes className="h-4 w-4" />
													</button>
													<ProductActionsMenu producto={producto} />
												</div>
											</div>
										</div>

										<div className="mt-4 grid grid-cols-2 gap-3">
											<div className="text-sm text-slate-700">
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</p>
												<p className="mt-1 truncate font-semibold text-slate-900">
													{producto.proveedor?.nombre_proveedor ?? "Sin proveedor"}
												</p>
											</div>
											<div className="text-sm text-slate-700">
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precios</p>
												<p className="mt-1 font-semibold text-slate-900">Venta: {currency.format(producto.precio_venta)}</p>
												<p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
													<span>Compra: {purchaseDisplay}</span>
													{producto.precio_compra > 0 ? null : (
														<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
															Sin costo
														</span>
													)}
												</p>
												<p className="mt-1 text-xs text-slate-500">Margen: {margin === null ? "—" : currency.format(margin)}</p>
											</div>
										</div>

										<div className="mt-3 text-sm">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</p>
											<div className="mt-1 flex flex-wrap items-center gap-2">
												<span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>
													<Boxes className="h-3.5 w-3.5" />
													{producto.cantidad_stock} uds
												</span>
												<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
													Mín: {producto.stock_minimo}
												</span>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					) : (
						<div className="mt-4 overflow-x-auto">
							<table className="min-w-[980px] w-full text-sm">
								<thead className="sticky top-0 bg-white">
									<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
										<th className="py-3 pr-4">Código</th>
										<th className="py-3 pr-4">Producto</th>
										<th className="py-3 pr-4">Proveedor</th>
										<th className="py-3 pr-4">Precios</th>
										<th className="py-3 pr-4">Stock</th>
										<th className="py-3 text-right">Acciones</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-200">
									{displayedProducts.map((producto) => {
										const stockStatus = resolveProductStockStatus(producto)
										const stockStatusText = productStockStatusLabel(stockStatus)
										const salesStatus = getCachedSalesStatus(producto.id_producto)
										const marginStatus = resolveMarginStatus(producto)
										const inferred = inferCategoryFromCode(producto.codigo_producto)
										const purchaseDisplay = producto.precio_compra > 0 ? currency.format(producto.precio_compra) : "—"
										const margin = computeMargin(producto.precio_compra, producto.precio_venta)
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

										return (
											<tr
												key={producto.id_producto}
												className="cursor-pointer hover:bg-slate-50"
												onClick={() => openDetail(producto)}
											>
												<td className="py-3 pr-4 align-top">
													<div className="flex flex-wrap items-center gap-2">
														<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
															{producto.codigo_producto}
														</span>
														<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
															{(inferred ?? "N/D").toUpperCase()}
														</span>
													</div>
												</td>
												<td className="py-3 pr-4 align-top">
													<p className="text-sm font-semibold text-slate-900">{producto.nombre_producto}</p>
													{producto.descripcion && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{producto.descripcion}</p>}
												</td>
												<td className="py-3 pr-4 align-top text-sm font-semibold text-slate-900">
													{producto.proveedor?.nombre_proveedor ?? "Sin proveedor"}
												</td>
												<td className="py-3 pr-4 align-top">
													<p className="text-xs font-semibold text-slate-900">Venta: {currency.format(producto.precio_venta)}</p>
																<p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
																	<span>Compra: {purchaseDisplay}</span>
																	{producto.precio_compra > 0 ? null : (
																		<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
																			Sin costo
																		</span>
																	)}
																</p>
																<p className="mt-1 text-xs text-slate-500">Margen: {margin === null ? "—" : currency.format(margin)}</p>
												</td>
												<td className="py-3 pr-4 align-top">
													<div className="flex flex-wrap items-center gap-2">
														<span className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>{stockStatusText}</span>
														<span className={`rounded-full px-3 py-1 text-xs font-semibold ${salesStatusClass}`}>
															{salesStatus ? salesStatusLabel(salesStatus) : "Ventas: —"}
														</span>
														<span className={`rounded-full px-3 py-1 text-xs font-semibold ${marginStatusClass}`}>{marginStatusLabel(marginStatus)}</span>
														<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
															{producto.cantidad_stock} / {producto.stock_minimo}
														</span>
													</div>
												</td>
													<td className="py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
														<div className="inline-flex items-center justify-end gap-1">
															<button
																type="button"
																onClick={() => openEdit(producto)}
																className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
																aria-label="Editar"
															>
																<Pencil className="h-4 w-4" />
															</button>
															<button
																type="button"
																onClick={() => openStockAdjust(producto)}
																className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
																aria-label="Ajustar stock"
															>
																<Boxes className="h-4 w-4" />
															</button>
															<ProductActionsMenu producto={producto} />
														</div>
													</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					)}

					{totalPages > 1 && (
						<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-xs text-slate-500">
								Página {currentPage} de {totalPages}
							</p>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
									disabled={currentPage <= 1}
									className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Anterior
								</button>
								<button
									type="button"
									onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
									disabled={currentPage >= totalPages}
									className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Siguiente
								</button>
							</div>
						</div>
					)}
				</div>

				{productosQuery.isLoading && (
					<div className="flex items-center justify-center gap-2 p-6 text-slate-500">
						<Loader2 className="h-4 w-4 animate-spin" />
						Cargando productos...
					</div>
				)}

				{!productosQuery.isLoading && displayedProducts.length === 0 && (
					<div className="p-8 text-center text-slate-500">
						<Package size={36} className="mx-auto mb-2 opacity-50" />
						<p>No hay productos que coincidan con la búsqueda.</p>
					</div>
				)}
			</section>

			<ProductsFiltersDrawer
				open={filtersOpen}
				onOpenChange={(open) => {
					if (!open) setFiltersOpen(false)
				}}
				filtersDraft={filtersDraft}
				setFiltersDraft={setFiltersDraft}
				proveedores={proveedores}
				onCancel={() => setFiltersOpen(false)}
				onClearDraft={() => setFiltersDraft({ ...defaultFilters })}
				onApply={applyFilters}
			/>

			<Drawer
				open={false}
				onOpenChange={(open) => {
					if (!open) setFiltersOpen(false)
				}}
			>
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
									value={filtersDraft.categoria}
									onChange={(event) =>
										setFiltersDraft((prev) => ({ ...prev, categoria: event.target.value as ProductsFilters["categoria"] }))
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
									value={String(filtersDraft.proveedorId)}
									onChange={(event) => {
										const raw = event.target.value
										setFiltersDraft((prev) => ({
											...prev,
											proveedorId: raw === "all" ? "all" : Number(raw),
										}))
									}}
									className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								>
									<option value="all">Todos</option>
									{proveedores.map((prov) => (
										<option key={prov.id_proveedor} value={prov.id_proveedor}>
											{prov.nombre_proveedor}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</label>
								<select
									value={filtersDraft.stock}
									onChange={(event) =>
										setFiltersDraft((prev) => ({ ...prev, stock: event.target.value as ProductsFilters["stock"] }))
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
								<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar</label>
								<select
									value={filtersDraft.orden}
									onChange={(event) =>
										setFiltersDraft((prev) => ({ ...prev, orden: event.target.value as ProductsFilters["orden"] }))
									}
									className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								>
									<option value="name_asc">Nombre A-Z</option>
									<option value="name_desc">Nombre Z-A</option>
									<option value="stock_asc">Stock asc</option>
									<option value="stock_desc">Stock desc</option>
									<option value="price_asc">Precio asc</option>
									<option value="price_desc">Precio desc</option>
									<option value="recent">Más recientes</option>
								</select>
							</div>
						</div>

						<div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
							<button
								type="button"
								onClick={() => setFiltersOpen(false)}
								className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
							>
								Cancelar
							</button>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setFiltersDraft({ ...defaultFilters })}
									className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									Limpiar
								</button>
								<button
									type="button"
									onClick={applyFilters}
									className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
								>
									Aplicar
								</button>
							</div>
						</div>
					</div>
				</DrawerContent>
			</Drawer>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						closeDialog()
					} else {
						setDialogOpen(true)
					}
				}}
			>
				<DialogContent
					className="w-full max-w-6xl overflow-hidden p-0 sm:rounded-3xl"
					hideCloseButton
					disableOutsideClose
				>
					<div className="flex h-[90vh] flex-col">
						<DialogHeader className="border-b px-8 py-6 text-left">
							<DialogTitle className="text-2xl font-semibold text-slate-900">
								{editingProduct ? "Editar producto" : "Nuevo producto"}
							</DialogTitle>
							<DialogDescription>Completa los datos y guarda.</DialogDescription>
						</DialogHeader>

						{formError && modalMode === "single" && (
							<div className="mx-8 mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{formError}
							</div>
						)}

						<div className="flex flex-wrap items-center gap-2 px-8 pt-4">
							<button
								onClick={() => {
									if (editingProduct) {
										setModalMode("single")
										return
									}
									if (modalMode === "import") {
										setModalMode("single")
									}
								}}
								className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
									modalMode !== "import"
										? "bg-emerald-600 text-white"
										: "border border-slate-200 text-slate-600 hover:border-slate-300"
								}`}
							>
								Registrar
							</button>
							{!editingProduct && (
								<button
									onClick={() => setModalMode("import")}
									className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
										modalMode === "import"
											? "bg-emerald-600 text-white"
											: "border border-slate-200 text-slate-600 hover:border-slate-300"
									}`}
								>
									Importar Excel
								</button>
							)}

						</div>

						{modalMode === "single" && (
								(editingProduct ? (
									<form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
										<div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
											<div className="grid gap-4 md:grid-cols-3">
												<div>
													<label className="text-xs font-medium uppercase text-slate-500">Categoría</label>
													<select
														{...form.register("categoria")}
															className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												>
															<option value="" className="text-slate-400">
																Selecciona una categoría
															</option>
														{productCategories.map((category) => (
															<option key={category.value} value={category.value}>
																{category.label}
															</option>
														))}
													</select>
													{form.formState.errors.categoria && (
														<p className="mt-1 text-xs text-red-600">{form.formState.errors.categoria.message}</p>
													)}
												</div>
												<div className="md:col-span-2">
													<label className="text-xs font-medium uppercase text-slate-500">Código generado</label>
													<input
														readOnly
														{...form.register("codigo_producto")}
														className="mt-1 w-full rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 text-sm font-semibold tracking-[0.2em] text-emerald-900"
													/>
													<p className="mt-1 text-xs text-emerald-700">
														El sistema garantiza unicidad (ej. CRD-001). Cambia la categoría para ajustar el prefijo.
													</p>
												</div>
											</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Nombre</label>
												<input
													{...form.register("nombre_producto")}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
													placeholder="Ej. Cuerda Ernie Ball 09"
												/>
												{form.formState.errors.nombre_producto && (
														<p className="mt-1 text-xs text-red-600">{form.formState.errors.nombre_producto.message}</p>
													)}
											</div>
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Proveedor</label>
												<select
													{...form.register("id_proveedor")}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
														disabled={proveedoresQuery.isLoading || proveedoresNoDisponibles || noProveedoresDisponibles}
													defaultValue=""
												>
														<option value="" className="text-slate-400">
															Selecciona un proveedor
														</option>
													{proveedores.map((prov) => (
														<option key={prov.id_proveedor} value={prov.id_proveedor}>
															{prov.nombre_proveedor}
														</option>
													))}
												</select>
												{form.formState.errors.id_proveedor && (
														<p className="mt-1 text-xs text-red-600">{form.formState.errors.id_proveedor.message}</p>
													)}
											</div>
										</div>

										<div>
											<label className="text-xs font-medium uppercase text-slate-500">Descripción</label>
											<textarea
												rows={3}
												{...form.register("descripcion")}
													className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												placeholder="Material, marca, observaciones..."
											/>
											{form.formState.errors.descripcion && (
												<p className="mt-1 text-xs text-red-600">{form.formState.errors.descripcion.message}</p>
											)}
										</div>

										<div className="grid gap-4 md:grid-cols-4">
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Precio compra</label>
												<input
													type="number"
													step="0.01"
															{...form.register("precio_compra", {
																onChange: () => form.clearErrors("precio_compra"),
															})}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												/>
												{form.formState.errors.precio_compra && (
													<p className="mt-1 text-xs text-red-600">{form.formState.errors.precio_compra.message}</p>
												)}
											</div>
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Precio venta</label>
												<input
													type="number"
													step="0.01"
															{...form.register("precio_venta", {
																onChange: () => form.clearErrors("precio_venta"),
															})}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												/>
												{form.formState.errors.precio_venta && (
													<p className="mt-1 text-xs text-red-600">{form.formState.errors.precio_venta.message}</p>
												)}
											</div>
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Stock actual</label>
												<input
													type="number"
															{...form.register("cantidad_stock", {
																onChange: () => form.clearErrors("cantidad_stock"),
															})}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												/>
												{form.formState.errors.cantidad_stock && (
													<p className="mt-1 text-xs text-red-600">{form.formState.errors.cantidad_stock.message}</p>
												)}
											</div>
											<div>
												<label className="text-xs font-medium uppercase text-slate-500">Stock mínimo</label>
												<input
													type="number"
															{...form.register("stock_minimo", {
																onChange: () => form.clearErrors("stock_minimo"),
															})}
														className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
												/>
												{form.formState.errors.stock_minimo && (
													<p className="mt-1 text-xs text-red-600">{form.formState.errors.stock_minimo.message}</p>
												)}
											</div>
										</div>

										<div className="rounded-2xl border border-slate-200 p-4">
											<div className="flex flex-wrap items-center gap-3">
												<p className="text-xs font-semibold uppercase text-slate-500">Imágenes ligeras</p>
												<div className="flex gap-2 text-xs">
													<button
														type="button"
														onClick={() => handleImageModeChange("url")}
														className={`rounded-full px-3 py-1 font-semibold ${
															imageMode === "url" ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600"
													}`}
													>
														Enlace público
													</button>
													<button
														type="button"
														onClick={() => handleImageModeChange("upload")}
														className={`rounded-full px-3 py-1 font-semibold ${
															imageMode === "upload" ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600"
													}`}
													>
														Archivo local
													</button>
												</div>
											</div>
											{imageMode === "url" ? (
												<div className="mt-3">
													<input
														{...form.register("imagen_url")}
																className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
														placeholder="https://cdn-loja.com/preview.jpg"
													/>
													<p className="mt-1 text-xs text-slate-500">Solo referenciamos vistas ligeras. El sistema de ventas cargará las imágenes completas.</p>
													{form.formState.errors.imagen_url && (
														<p className="mt-1 text-xs text-red-600">{form.formState.errors.imagen_url.message}</p>
													)}
												</div>
											) : (
												<div className="mt-3 space-y-2">
													<label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-400 px-4 py-6 text-center text-sm text-emerald-700">
														<UploadCloud className="mb-2 h-6 w-6" />
														Arrastra o haz clic para cargar una vista previa ligera (max 160px)
														<input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
													</label>
													{imageUploadError && <p className="text-xs text-red-600">{imageUploadError}</p>}
													{imageProcessing && (
														<p className="flex items-center gap-2 text-xs text-slate-500">
															<Loader2 className="h-3.5 w-3.5 animate-spin" /> Optimizando imagen...
														</p>
													)}
												</div>
											)}
											{resolvedPreview && (
												<div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
														<ImageIcon className="h-5 w-5" />
													</div>
													<div>
														<p className="text-xs font-semibold text-slate-700">Imagen registrada (no visible en panel)</p>
														<p className="text-xs text-slate-500">Las imágenes se visualizarán únicamente en la interfaz de cliente.</p>
													</div>
												</div>
											)}
										</div>
									</div>

									<div className="flex justify-end gap-2 border-t border-slate-200 px-8 py-4">
										<button
											type="button"
											onClick={closeDialog}
											className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
										>
											Cancelar
										</button>
										<button
											type="submit"
											className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
											disabled={isMutating || noProveedoresDisponibles}
										>
											{isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
											Guardar
										</button>
									</div>
									</form>
								) : (
									<div className="flex flex-1 flex-col overflow-hidden">
										<div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
												<div className="rounded-2xl border border-slate-200 p-4">
													<p className="text-sm font-semibold text-slate-700">Categoría y proveedor</p>
												<div className="mt-4 grid gap-4 md:grid-cols-2">
													<div>
														<label className="text-xs font-medium uppercase text-slate-500">Categoría</label>
														<select
															{...form.register("categoria")}
															className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
														>
															<option value="" className="text-slate-400">
																Selecciona una categoría
															</option>
															{productCategories.map((category) => (
																<option key={category.value} value={category.value}>
																	{category.label}
																</option>
															))}
														</select>
														{form.formState.errors.categoria && (
															<p className="mt-1 text-xs text-red-600">{form.formState.errors.categoria.message}</p>
														)}
													</div>
													<div>
														<label className="text-xs font-medium uppercase text-slate-500">Proveedor</label>
														<select
															{...form.register("id_proveedor")}
															className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
															disabled={proveedoresQuery.isLoading || proveedoresNoDisponibles || noProveedoresDisponibles}
															defaultValue=""
														>
															<option value="" className="text-slate-400">
																Selecciona un proveedor
															</option>
															{proveedores.map((prov) => (
																<option key={prov.id_proveedor} value={prov.id_proveedor}>
																	{prov.nombre_proveedor}
																</option>
															))}
														</select>
														{form.formState.errors.id_proveedor && (
															<p className="mt-1 text-xs text-red-600">{form.formState.errors.id_proveedor.message}</p>
														)}
													</div>
												</div>
											</div>

											<div className="rounded-2xl border border-slate-200 p-4">
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div>
														<p className="text-sm font-semibold text-slate-700">Productos</p>
													</div>
													<button
														type="button"
														onClick={() => {
															setBatchRows((rows) => {
																const categoria = (form.getValues("categoria") as ProductCategoryValue | "") ?? ""
																const newRow = createBlankBatchRow()
																if (!categoria) return [...rows, newRow]
																const prefix = getCategoryPrefix(categoria)
																if (!prefix) return [...rows, newRow]
																const taken = new Set<string>(dialogEffectiveTakenCodes)
																rows.forEach((row) => {
																	if (row.codigo_producto) taken.add(row.codigo_producto.toUpperCase())
																})
																const codigo = buildNextCode(prefix, taken)
																return [...rows, { ...newRow, codigo_producto: codigo }]
															})
														}}
														className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
													>
														<Plus className="h-4 w-4" />
														Agregar fila
													</button>
												</div>

												<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
													<p className="text-xs text-slate-600">
														Listos: <span className="font-semibold text-slate-900">{batchReadyCount}</span> / {batchRows.length}
													</p>
												</div>

												<div className="mt-4 overflow-x-auto">
													<table className="min-w-[980px] w-full text-sm">
														<thead>
															<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
																<th className="py-2 pr-3">Código</th>
																<th className="py-2 pr-3">Nombre</th>
																<th className="py-2 pr-3">Compra</th>
																<th className="py-2 pr-3">Venta</th>
																<th className="py-2 pr-3">Stock</th>
																<th className="py-2 pr-3">Mínimo</th>
																<th className="py-2">Estado</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-slate-200">
															{batchRows.map((row) => {
																const issues = getBatchRowIssues(row)
																const saveError = batchRowSaveErrors[row.id]
																const hasProblems = issues.length > 0 || Boolean(saveError)
																return (
																	<tr key={row.id} className={hasProblems ? "bg-red-50/30" : undefined}>
																		<td className="py-3 pr-3 align-top">
																			<input
																				readOnly
																				value={row.codigo_producto}
																				placeholder="Selecciona categoría"
																					className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold tracking-[0.16em] text-slate-700"
																			/>
																		</td>
																		<td className="py-3 pr-3 align-top">
																			<input
																				value={row.nombre_producto}
																				onChange={(event) => handleBatchFieldChange(row.id, "nombre_producto", event.target.value)}
																				className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
																				placeholder="Nombre del producto"
																			/>
																		</td>
																		<td className="py-3 pr-3 align-top">
																			<input
																				type="number"
																				step="0.01"
																				value={row.precio_compra}
																				onChange={(event) => handleBatchFieldChange(row.id, "precio_compra", Number(event.target.value))}
																				className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
																			/>
																		</td>
																		<td className="py-3 pr-3 align-top">
																			<input
																				type="number"
																				step="0.01"
																				value={row.precio_venta}
																				onChange={(event) => handleBatchFieldChange(row.id, "precio_venta", Number(event.target.value))}
																				className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
																			/>
																		</td>
																		<td className="py-3 pr-3 align-top">
																			<input
																				type="number"
																				value={row.cantidad_stock}
																				onChange={(event) => handleBatchFieldChange(row.id, "cantidad_stock", Number(event.target.value))}
																				className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
																			/>
																		</td>
																		<td className="py-3 pr-3 align-top">
																			<input
																				type="number"
																				value={row.stock_minimo}
																				onChange={(event) => handleBatchFieldChange(row.id, "stock_minimo", Number(event.target.value))}
																				className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
																			/>
																		</td>
																		<td className="py-3 align-top">
																			<div className="flex items-start justify-between gap-2">
																				<div className="min-w-0">
																					{issues.length > 0 ? (
																						<p className="text-xs font-semibold text-amber-700">Faltan: {issues.join(", ")}</p>
																					) : (
																						<p className="text-xs font-semibold text-emerald-700">Lista</p>
																					)}
																					{saveError && <p className="mt-1 text-xs text-red-700">{saveError}</p>}
																				</div>
																				<button
																					type="button"
																					onClick={() => {
																						setBatchRowSaveErrors((prev) => {
																								if (!prev[row.id]) return prev
																								const copy = { ...prev }
																								delete copy[row.id]
																								return copy
																							})
																						setBatchRows((rows) => rows.filter((item) => item.id !== row.id))
																					}}
																					className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
																					disabled={batchRows.length <= 1}
																				>
																					<Trash2 className="h-4 w-4" />
																				</button>
																			</div>
																		</td>
																	</tr>
																)
														})}
														</tbody>
													</table>
												</div>
											</div>
										</div>

										<div className="flex justify-end gap-2 border-t border-slate-200 px-8 py-4">
											<button
												type="button"
												onClick={closeDialog}
												className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
											>
												Cancelar
											</button>
											<button
												type="button"
												onClick={handleBatchSubmit}
												className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
												disabled={batchSubmitting || batchReadyCount === 0 || noProveedoresDisponibles}
											>
												{batchSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
												Guardar {batchReadyCount} producto{batchReadyCount === 1 ? "" : "s"}
											</button>
										</div>
									</div>
								))
						)}

						{modalMode === "import" && (
							<div className="flex flex-1 flex-col overflow-hidden">
								<div className="flex-1 space-y-4 overflow-y-auto px-8 py-6">
									<div className="rounded-2xl border border-slate-200 p-4">
										<p className="text-sm font-semibold text-slate-700">Sube tu archivo Excel (.xls o .xlsx)</p>
										<p className="text-xs text-slate-500">Cada columna puede mapearse a los campos administrativos.</p>
										<label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
											<UploadCloud className="h-4 w-4" />
											Seleccionar archivo
											<input
												type="file"
												accept=".xlsx,.xls"
												className="hidden"
												onChange={(event) => {
													const file = event.target.files?.[0]
													if (file) {
														handleImportFile(file)
														event.target.value = ""
													}
												}}
											/>
										</label>
										{importState && (
											<p className="mt-2 text-xs text-slate-500">Archivo activo: {importState.filename}</p>
										)}
										{importError && (
											<p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">{importError}</p>
										)}
									</div>

									{importState && (
										<div className="space-y-4">
											<div className="rounded-2xl border border-slate-200 p-4">
												<p className="text-sm font-semibold text-slate-700">Mapeo de columnas</p>
												<div className="mt-3 grid gap-3 md:grid-cols-2">
													{importFieldConfig.map((field) => (
														<div key={field.key}>
															<label className="text-xs font-medium uppercase text-slate-500">
																{field.label}
																{field.required && <span className="text-red-500"> *</span>}
															</label>
															<select
																value={importState.mapping[field.key] ?? ""}
																onChange={(event) =>
																	setImportState((prev) =>
																		prev ? { ...prev, mapping: { ...prev.mapping, [field.key]: event.target.value || null } } : prev
																	)
																}
																		className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
															>
																		<option value="" className="text-slate-400">
																			Sin asignar
																		</option>
																{importState.headers.map((header) => (
																	<option key={header} value={header}>
																		{header}
																	</option>
																))}
															</select>
														</div>
													))}
												</div>
											</div>

											<div className="rounded-2xl border border-slate-200">
												<div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm text-slate-600">
													<p>
														Vista previa ({resolvedImportRows.length} filas · {validImportRows.length} listas para importar)
													</p>
												</div>
												<div className="max-h-72 overflow-auto text-xs">
													<table className="min-w-full divide-y divide-slate-200">
														<thead className="bg-slate-50">
															<tr>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Nombre</th>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Categoría</th>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Proveedor</th>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Precio</th>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Stock</th>
																<th className="px-3 py-2 text-left font-semibold text-slate-500">Estado</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-slate-200 bg-white">
															{resolvedImportRows.map((row) => (
																<tr key={row.id}>
																	<td className="px-3 py-2">{row.data.nombre}</td>
																	<td className="px-3 py-2">{row.data.categoria || "-"}</td>
																	<td className="px-3 py-2">{row.data.proveedorId || "-"}</td>
																	<td className="px-3 py-2">{currency.format(row.data.precio_venta)}</td>
																	<td className="px-3 py-2">{row.data.cantidad_stock}</td>
																	<td className="px-3 py-2">
																		{row.issues.length === 0 ? (
																			<span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Listo</span>
																		) : (
																			<span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
																				Falta: {row.issues.join(", ")}
																			</span>
																		)}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										</div>
									)}
								</div>

								<div className="flex justify-between border-t border-slate-200 px-8 py-4">
									<button
										type="button"
										onClick={closeDialog}
										className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
									>
										Cancelar
									</button>
									<button
										type="button"
										onClick={handleImportConfirm}
										className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
										disabled={importSubmitting || validImportRows.length === 0}
									>
										{importSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
										Importar ({validImportRows.length})
									</button>
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<ProductsDetailDrawer
				open={detailOpen}
				onOpenChange={(open) => {
					if (!open) closeDetail()
				}}
				product={detailProduct}
				inferCategoryFromCode={inferCategoryFromCode}
				currency={currency}
				dateFormatter={dateFormatter}
				sales={{
					isLoading: productSalesQuery.isLoading,
					isError: productSalesQuery.isError,
					error: productSalesQuery.error,
					data: productSalesQuery.data,
				}}
				movements={{
					isLoading: kardexQuery.isLoading,
					isError: kardexQuery.isError,
					data: kardexQuery.data,
				}}
				onRetrySales={() => {
					productSalesQuery.refetch()
				}}
				onRetryMovements={() => {
					kardexQuery.refetch()
				}}
				onEdit={() => {
					if (!detailProduct) return
					openEdit(detailProduct)
					closeDetail()
				}}
				onAdjustStock={() => {
					if (!detailProduct) return
					openStockAdjust(detailProduct)
					closeDetail()
				}}
				onHistory={() => {
					navigate("/ventas")
					closeDetail()
				}}
				onClose={closeDetail}
			/>

			<Dialog
				open={deleteConfirmOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteConfirmOpen(false)
						setDeleteTarget(null)
					}
				}}
			>
				<DialogContent className="max-w-md" hideCloseButton>
					<DialogHeader>
						<DialogTitle>Confirmar eliminación</DialogTitle>
						<DialogDescription>
							¿Seguro que deseas eliminar {deleteTarget?.nombre_producto ?? "este producto"}? Esta acción es permanente.
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4 flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={() => {
							setDeleteConfirmOpen(false)
							setDeleteTarget(null)
						}}
							className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
						>
							Cancelar
						</button>
						<button
							type="button"
							disabled={deleteMutation.isPending || !deleteTarget}
							onClick={() => {
							if (!deleteTarget) return
							deleteMutation.mutate(deleteTarget.id_producto)
							setDeleteConfirmOpen(false)
							setDeleteTarget(null)
						}}
							className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							{deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
							Eliminar
						</button>
					</div>
				</DialogContent>
			</Dialog>

			<Drawer
				open={false}
				onOpenChange={(open) => {
					if (!open) closeDetail()
				}}
			>
				<DrawerContent className="overflow-hidden">
					{detailProduct && (
						<div className="flex h-dvh flex-col">
							<DrawerHeader>
								<DrawerTitle className="pr-10">{detailProduct.nombre_producto}</DrawerTitle>
								<DrawerDescription className="mt-1 flex flex-wrap items-center gap-2">
									{(() => {
										const status = resolveStockStatus(detailProduct)
										const statusClass =
											status === "out"
												? "bg-slate-100 text-slate-700"
												: status === "critical"
													? "bg-red-50 text-red-700"
													: status === "low"
														? "bg-amber-50 text-amber-700"
														: "bg-emerald-50 text-emerald-700"

										return (
											<>
									<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
										{detailProduct.codigo_producto}
									</span>
									<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
										{(inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}
									</span>
									<span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{stockStatusLabel(status)}</span>
										</>
									)
									})()}
								</DrawerDescription>
								<div className="mt-4 flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={() => {
											openEdit(detailProduct)
											closeDetail()
										}}
										className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										Editar
									</button>
									<button
										type="button"
										onClick={() => {
											openStockAdjust(detailProduct)
											closeDetail()
										}}
										className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										Ajustar stock
									</button>
									<button
										type="button"
										onClick={() => {
											navigate("/ventas")
											closeDetail()
										}}
										className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										Historial
									</button>
									<button
										type="button"
										onClick={closeDetail}
										className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
									>
										Cerrar
									</button>
								</div>
							</DrawerHeader>

							<div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
								{(() => {
									const status = resolveStockStatus(detailProduct)
									const statusText = stockStatusLabel(status)
									const purchaseDisplay = detailProduct.precio_compra > 0 ? currency.format(detailProduct.precio_compra) : "—"
									const margin = computeMargin(detailProduct.precio_compra, detailProduct.precio_venta)
									const percent =
										detailProduct.stock_minimo > 0 ? Math.min(100, Math.round((detailProduct.cantidad_stock / detailProduct.stock_minimo) * 100)) : 100
									const statusClass =
										status === "out"
											? "bg-slate-100 text-slate-700"
											: status === "critical"
												? "bg-red-50 text-red-700"
												: status === "low"
													? "bg-amber-50 text-amber-700"
													: "bg-emerald-50 text-emerald-700"

									return (
										<>
											<div className="rounded-2xl border border-slate-200 p-4">
												<p className="text-sm font-semibold text-slate-700">Stock</p>
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
														<span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusText}</span>
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
														<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.proveedor?.nombre_proveedor ?? "Sin proveedor"}</p>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.codigo_producto}</p>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{(inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}</p>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.descripcion?.trim() ? detailProduct.descripcion : "—"}</p>
													</div>
												</div>
											</div>

											<div className="rounded-2xl border border-slate-200 p-4">
												<p className="text-sm font-semibold text-slate-700">Precios</p>
												<div className="mt-4 grid gap-4 sm:grid-cols-3">
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Venta</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{currency.format(detailProduct.precio_venta)}</p>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compra</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{purchaseDisplay}</p>
													</div>
													<div>
														<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Margen</p>
														<p className="mt-1 text-sm font-semibold text-slate-900">{margin === null ? "—" : currency.format(margin)}</p>
													</div>
												</div>
											</div>
										</>
									)
								})()}

								<div className="rounded-2xl border border-slate-200 p-4">
								<p className="text-sm font-semibold text-slate-700">Ventas</p>
								{productSalesQuery.isLoading ? (
									<p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" /> Cargando...
									</p>
								) : productSalesQuery.isError ? (
									<p className="mt-2 text-sm text-red-600">No se pudo cargar el historial.</p>
								) : (
									<>
											<div className="mt-3 grid gap-4 sm:grid-cols-3">
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total vendido</p>
												<p className="mt-1 text-2xl font-semibold text-slate-900">{productSalesQuery.data?.totalUnitsSold ?? 0}</p>
											</div>
											<div>
													<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos 30 días</p>
													<p className="mt-1 text-2xl font-semibold text-slate-900">{productSalesQuery.data?.last30DaysUnitsSold ?? 0}</p>
												</div>
												<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última venta</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">
													{productSalesQuery.data?.lastSaleDate
														? dateFormatter.format(new Date(productSalesQuery.data.lastSaleDate))
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
													{(productSalesQuery.data?.recentLines ?? []).length === 0 ? (
														<tr>
															<td colSpan={4} className="py-8 text-center text-sm text-slate-500">
																<Package size={28} className="mx-auto mb-2 opacity-50" />
																Sin ventas registradas para este producto.
															</td>
														</tr>
													) : (
														(productSalesQuery.data?.recentLines ?? []).map((line) => (
															<tr key={`${line.id_factura}-${line.fecha_factura}-${line.cantidad}`}>
																<td className="py-3 pr-3 align-top text-xs text-slate-600">
																	{dateFormatter.format(new Date(line.fecha_factura))}
																</td>
																<td className="py-3 pr-3 align-top">
																	<span className="text-xs font-semibold text-slate-800">{line.numero_factura}</span>
																</td>
																<td className="py-3 pr-3 align-top text-xs font-semibold text-slate-800">{line.cantidad}</td>
																<td className="py-3 align-top text-xs font-semibold text-slate-900">{currency.format(line.subtotal)}</td>
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
					</div>
					)}
				</DrawerContent>
			</Drawer>
		</div>
	)
}

