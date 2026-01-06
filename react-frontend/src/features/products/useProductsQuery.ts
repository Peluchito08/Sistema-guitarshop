import { useQuery } from "@tanstack/react-query"

import { productClient } from "./product.client"
import type { KardexMovimientoRecord, ProductoRecord, ProductSalesSummary, ProveedorRecord } from "./product.types"

export const productsQueryKey = ["productos"] as const
export const providersQueryKey = ["proveedores"] as const
export const productImagesQueryKey = ["productos-imagenes"] as const

export const useProductsQuery = (enabled = true) => {
	return useQuery<ProductoRecord[]>({
		queryKey: productsQueryKey,
		enabled,
		staleTime: 30_000,
		queryFn: () => productClient.list(),
	})
}

export const useProvidersQuery = (enabled = true) => {
	return useQuery<ProveedorRecord[]>({
		queryKey: providersQueryKey,
		enabled,
		staleTime: 60_000,
		queryFn: () => productClient.listProviders(),
	})
}

export const useProductImagesQuery = (enabled = true) => {
	return useQuery<Record<number, string>>({
		queryKey: productImagesQueryKey,
		enabled,
		staleTime: 60_000,
		queryFn: () => productClient.listImages(),
	})
}

export const useProductSalesSummaryQuery = (productId: number, enabled: boolean) => {
	return useQuery<ProductSalesSummary>({
		queryKey: ["producto-ventas", productId],
		enabled: enabled && Boolean(productId),
		staleTime: 30_000,
		queryFn: () => productClient.getSalesSummary(productId),
	})
}

export const useKardexQuery = (enabled = true) => {
	return useQuery<KardexMovimientoRecord[]>({
		queryKey: ["kardex"],
		enabled,
		staleTime: 30_000,
		queryFn: () => productClient.listKardex(),
	})
}
