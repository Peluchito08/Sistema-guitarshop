import prisma from "../../../shared/prisma/prismaClient";
import { Prisma } from "../../../../generated/prisma/client";

const productoSelect = {
  id_producto: true,
  codigo_producto: true,
  nombre_producto: true,
  descripcion: true,
  id_proveedor: true,
  precio_compra: true,
  precio_venta: true,
  cantidad_stock: true,
  stock_minimo: true,
  fecha_creacion: true,
  id_estado: true,
} as const;

// ==========================
// LISTAR PRODUCTOS
// ==========================
export async function listarProductos() {
  const productos = await prisma.producto.findMany({
    where: { id_estado: 1 }, // solo activos (cámbialo si quieres ver todos)
    select: {
      ...productoSelect,
      proveedor: {
        select: {
          id_proveedor: true,
          nombre_proveedor: true,
        },
      },
    },
    orderBy: { id_producto: "asc" },
  });

  return productos;
}

export type StockStatusFilter = "all" | "normal" | "low" | "critical" | "risk";

export type ProductSortKey =
  | "name-asc"
  | "name-desc"
  | "stock-asc"
  | "stock-desc"
  | "margin-desc";

export type ListarProductosPaginadoParams = {
  page: number;
  pageSize: number;
  search?: string | null;
  categoryPrefix?: string | null;
  providerId?: number | null;
  stockStatus?: StockStatusFilter;
  sortKey?: ProductSortKey;
};

export type ProductosKpis = {
  total: number;
  risk: number;
  low: number;
  critical: number;
  inventoryValue: string; // Decimal-like
};

export type ListarProductosPaginadoResult = {
  items: Array<{
    id_producto: number;
    codigo_producto: string;
    nombre_producto: string;
    descripcion: string | null;
    id_proveedor: number | null;
    precio_compra: Prisma.Decimal | number | string;
    precio_venta: Prisma.Decimal | number | string;
    cantidad_stock: number;
    stock_minimo: number;
    proveedor: { id_proveedor: number; nombre_proveedor: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  kpis: ProductosKpis;
};

const LOW_STOCK_RATIO = 0.2;

const buildWhereSql = (params: ListarProductosPaginadoParams) => {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.id_estado = 1`];

  const search = params.search?.trim();
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      Prisma.sql`(p.nombre_producto ILIKE ${like} OR p.codigo_producto ILIKE ${like})`
    );
  }

  const categoryPrefix = params.categoryPrefix?.trim();
  if (categoryPrefix) {
    conditions.push(Prisma.sql`p.codigo_producto ILIKE ${categoryPrefix.toUpperCase() + "%"}`);
  }

  if (params.providerId) {
    conditions.push(Prisma.sql`p.id_proveedor = ${params.providerId}`);
  }

  const ratio = 1 + LOW_STOCK_RATIO;
  switch (params.stockStatus ?? "all") {
    case "critical":
      conditions.push(Prisma.sql`p.cantidad_stock <= p.stock_minimo`);
      break;
    case "low":
      conditions.push(
        Prisma.sql`p.cantidad_stock > p.stock_minimo AND p.cantidad_stock <= CEIL((p.stock_minimo::numeric) * ${ratio})`
      );
      break;
    case "normal":
      conditions.push(
        Prisma.sql`p.cantidad_stock > CEIL((p.stock_minimo::numeric) * ${ratio})`
      );
      break;
    case "risk":
      conditions.push(
        Prisma.sql`p.cantidad_stock <= CEIL((p.stock_minimo::numeric) * ${ratio})`
      );
      break;
    default:
      break;
  }

  return Prisma.sql`${Prisma.join(conditions, " AND ")}`;
};

const resolveOrderBySql = (sortKey: ProductSortKey | undefined) => {
  switch (sortKey ?? "name-asc") {
    case "name-desc":
      return Prisma.sql`p.nombre_producto DESC, p.id_producto ASC`;
    case "stock-asc":
      return Prisma.sql`p.cantidad_stock ASC, p.nombre_producto ASC`;
    case "stock-desc":
      return Prisma.sql`p.cantidad_stock DESC, p.nombre_producto ASC`;
    case "margin-desc":
      return Prisma.sql`(p.precio_venta - p.precio_compra) DESC, p.nombre_producto ASC`;
    case "name-asc":
    default:
      return Prisma.sql`p.nombre_producto ASC, p.id_producto ASC`;
  }
};

type ProductoPaginadoRow = {
  id_producto: number | string;
  codigo_producto: string;
  nombre_producto: string;
  descripcion: string | null;
  id_proveedor: number | string | null;
  precio_compra: Prisma.Decimal | number | string | null;
  precio_venta: Prisma.Decimal | number | string | null;
  cantidad_stock: number | string | null;
  stock_minimo: number | string | null;
  proveedor_id: number | string | null;
  proveedor_nombre: string | null;
};

type CountRow = { total: number | string };

type KpiRow = {
  total: number | string;
  critical: number | string;
  low: number | string;
  risk: number | string;
  inventory_value: Prisma.Decimal | number | string;
};

export async function listarProductosPaginado(
  params: ListarProductosPaginadoParams
): Promise<ListarProductosPaginadoResult> {
  const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page)) : 1;
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.max(1, Math.min(200, Math.floor(params.pageSize)))
    : 25;
  const offset = (page - 1) * pageSize;

  const whereSql = buildWhereSql({ ...params, page, pageSize });
  const orderBySql = resolveOrderBySql(params.sortKey);

  const [rows, countRows, kpiRows] = await prisma.$transaction([
    prisma.$queryRaw<ProductoPaginadoRow[]>(Prisma.sql`
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.descripcion,
        p.id_proveedor,
        p.precio_compra,
        p.precio_venta,
        p.cantidad_stock,
        p.stock_minimo,
        pr.id_proveedor as proveedor_id,
        pr.nombre_proveedor as proveedor_nombre
      FROM producto p
      LEFT JOIN proveedor pr ON pr.id_proveedor = p.id_proveedor
      WHERE ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int as total
      FROM producto p
      WHERE ${whereSql}
    `),
    prisma.$queryRaw<KpiRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN p.cantidad_stock <= p.stock_minimo THEN 1 ELSE 0 END)::int as critical,
        SUM(CASE WHEN p.cantidad_stock > p.stock_minimo AND p.cantidad_stock <= CEIL((p.stock_minimo::numeric) * ${
          1 + LOW_STOCK_RATIO
        }) THEN 1 ELSE 0 END)::int as low,
        SUM(CASE WHEN p.cantidad_stock <= CEIL((p.stock_minimo::numeric) * ${
          1 + LOW_STOCK_RATIO
        }) THEN 1 ELSE 0 END)::int as risk,
        COALESCE(SUM(
          CASE
            WHEN p.precio_compra > 0 AND p.cantidad_stock > 0 THEN (p.precio_compra * p.cantidad_stock)
            ELSE 0
          END
        ), 0) as inventory_value
      FROM producto p
      WHERE ${whereSql}
    `),
  ]);

  const total = Number(countRows?.[0]?.total ?? 0);
  const k = kpiRows?.[0] ?? {};

  const items = (rows ?? []).map((r) => ({
    id_producto: Number(r.id_producto),
    codigo_producto: String(r.codigo_producto),
    nombre_producto: String(r.nombre_producto),
    descripcion: r.descripcion ?? null,
    id_proveedor: r.id_proveedor === null ? null : Number(r.id_proveedor),
    precio_compra: r.precio_compra ?? 0,
    precio_venta: r.precio_venta ?? 0,
    cantidad_stock: Number(r.cantidad_stock ?? 0),
    stock_minimo: Number(r.stock_minimo ?? 0),
    proveedor:
      r.proveedor_id && r.proveedor_nombre
        ? {
            id_proveedor: Number(r.proveedor_id),
            nombre_proveedor: String(r.proveedor_nombre),
          }
        : null,
  }));

  const critical = Number(k.critical ?? 0);
  const low = Number(k.low ?? 0);
  const risk = Number(k.risk ?? 0);

  return {
    items,
    total,
    page,
    pageSize,
    kpis: {
      total: Number(k.total ?? total),
      critical,
      low,
      risk,
      inventoryValue: String(k.inventory_value ?? "0"),
    },
  };
}

export async function listarCodigosProductoActivos() {
  const rows = await prisma.producto.findMany({
    where: { id_estado: 1 },
    select: { codigo_producto: true },
    orderBy: { codigo_producto: "asc" },
  });
  return rows.map((r) => r.codigo_producto);
}

// ==========================
// OBTENER PRODUCTO POR ID
// ==========================
export async function obtenerProductoPorId(id: number) {
  const producto = await prisma.producto.findUnique({
    where: { id_producto: id },
    select: {
      ...productoSelect,
      proveedor: {
        select: {
          id_proveedor: true,
          nombre_proveedor: true,
        },
      },
    },
  });

  return producto; // puede ser null
}

// ==========================
// CREAR PRODUCTO
// ==========================
export async function crearProducto(data: {
  codigo_producto: string;
  nombre_producto: string;
  descripcion?: string | null;
  id_proveedor?: number | null;
  precio_compra: number | string;
  precio_venta: number | string;
  cantidad_stock?: number;
  stock_minimo?: number;
  id_usuario_modifi?: number | null;
}) {
  if (!data.id_proveedor) {
    throw new Error("PROVEEDOR_REQUERIDO");
  }

  try {
    const producto = await prisma.producto.create({
      data: {
        codigo_producto: data.codigo_producto,
        nombre_producto: data.nombre_producto,
        descripcion: data.descripcion ?? null,
        id_proveedor: data.id_proveedor,
        precio_compra: data.precio_compra,
        precio_venta: data.precio_venta,
        cantidad_stock: data.cantidad_stock ?? 0,
        stock_minimo: data.stock_minimo ?? 0,
        id_estado: 1,
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
      select: {
        ...productoSelect,
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_proveedor: true,
          },
        },
      },
    });

    return producto;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // código de producto duplicado
      throw new Error("PRODUCTO_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ACTUALIZAR PRODUCTO
// ==========================
export async function actualizarProducto(
  id: number,
  data: {
    codigo_producto?: string;
    nombre_producto?: string;
    descripcion?: string | null;
    id_proveedor?: number | null;
    precio_compra?: number | string;
    precio_venta?: number | string;
    cantidad_stock?: number;
    stock_minimo?: number;
    id_usuario_modifi?: number | null;
  }
) {
  if (data.id_proveedor !== undefined && !data.id_proveedor) {
    throw new Error("PROVEEDOR_REQUERIDO");
  }

  const updateData: Prisma.productoUncheckedUpdateInput = {};

  if (data.codigo_producto !== undefined)
    updateData.codigo_producto = data.codigo_producto;
  if (data.nombre_producto !== undefined)
    updateData.nombre_producto = data.nombre_producto;
  if (data.descripcion !== undefined)
    updateData.descripcion = data.descripcion;
  if (data.id_proveedor !== undefined)
    updateData.id_proveedor = data.id_proveedor;
  if (data.precio_compra !== undefined)
    updateData.precio_compra = data.precio_compra;
  if (data.precio_venta !== undefined)
    updateData.precio_venta = data.precio_venta;
  if (data.cantidad_stock !== undefined)
    updateData.cantidad_stock = data.cantidad_stock;
  if (data.stock_minimo !== undefined)
    updateData.stock_minimo = data.stock_minimo;
  if (data.id_usuario_modifi !== undefined)
    updateData.id_usuario_modifi = data.id_usuario_modifi;

  try {
    const producto = await prisma.producto.update({
      where: { id_producto: id },
      data: updateData,
      select: {
        ...productoSelect,
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_proveedor: true,
          },
        },
      },
    });

    return producto;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("PRODUCTO_DUPLICADO");
    }
    throw error;
  }
}

// ==========================
// ELIMINAR PRODUCTO
// (solo si no tiene relaciones)
// ==========================
export async function eliminarProducto(id: number) {
  // Verificar si el producto está usado en compras, facturas o kardex
  const [enCompras, enFacturas, enKardex] = await Promise.all([
    prisma.producto_compra.count({ where: { id_producto: id } }),
    prisma.detalle_factura.count({ where: { id_producto: id } }),
    prisma.kardex.count({ where: { id_producto: id } }),
  ]);

  if (enCompras > 0 || enFacturas > 0 || enKardex > 0) {
    throw new Error("PRODUCTO_CON_RELACIONES");
  }

  const producto = await prisma.producto.delete({
    where: { id_producto: id },
    select: productoSelect,
  });

  return producto;
}
