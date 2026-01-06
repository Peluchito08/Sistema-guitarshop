// guitarshop-backend/app/api/producto/route.ts
import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";
import {
  listarProductos,
  listarProductosPaginado,
  crearProducto,
  type ProductSortKey,
  type StockStatusFilter,
} from "../../../lib/services/productoService";

function parseStockStatusFilter(value: string | null): StockStatusFilter {
  if (value === "normal" || value === "low" || value === "critical" || value === "risk") {
    return value;
  }
  return "all";
}

function parseProductSortKey(value: string | null): ProductSortKey {
  if (
    value === "name-asc" ||
    value === "name-desc" ||
    value === "stock-asc" ||
    value === "stock-desc" ||
    value === "margin-desc"
  ) {
    return value;
  }
  return "name-asc";
}

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/producto
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    const hasPagination = Boolean(pageParam || pageSizeParam);
    if (!hasPagination) {
      const productos = await listarProductos();
      return jsonCors(productos, { status: 200 });
    }

    const page = Math.max(1, Number(pageParam ?? 1));
    const pageSize = Math.max(1, Number(pageSizeParam ?? 25));

    const providerIdRaw = url.searchParams.get("providerId");
    const providerId = providerIdRaw ? Number(providerIdRaw) : null;
    const providerIdNormalized = providerId && Number.isFinite(providerId) && providerId > 0 ? providerId : null;

    const stockStatus = parseStockStatusFilter(url.searchParams.get("stockStatus"));
    const sortKey = parseProductSortKey(url.searchParams.get("sortKey"));

    const payload = await listarProductosPaginado({
      page,
      pageSize,
      search: url.searchParams.get("search"),
      categoryPrefix: url.searchParams.get("categoryPrefix"),
      providerId: providerIdNormalized,
      stockStatus,
      sortKey,
    });

    return jsonCors(payload, { status: 200 });
  } catch (error) {
    console.error("Error GET /producto:", error);
    return jsonCors(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

// POST /api/producto
export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const producto = await crearProducto({
      codigo_producto: body.codigo_producto,
      nombre_producto: body.nombre_producto,
      descripcion: body.descripcion ?? null,
      id_proveedor: body.id_proveedor ?? null,
      precio_compra: body.precio_compra,
      precio_venta: body.precio_venta,
      cantidad_stock: body.cantidad_stock ?? 0,
      stock_minimo: body.stock_minimo ?? 0,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(producto, { status: 201 });
  } catch (error: unknown) {
    console.error("Error POST /producto:", error);

    if (error instanceof Error) {
      if (error.message === "PRODUCTO_DUPLICADO") {
        return jsonCors(
          { error: "El código de producto ya está registrado" },
          { status: 400 }
        );
      }
      if (error.message === "PROVEEDOR_REQUERIDO") {
        return jsonCors(
          { error: "Debes seleccionar un proveedor" },
          { status: 400 }
        );
      }
    }

    return jsonCors(
      { error: "Error al crear producto" },
      { status: 500 }
    );
  }
}
