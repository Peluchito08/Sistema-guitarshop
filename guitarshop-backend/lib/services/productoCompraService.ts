// lib/services/productoCompraService.ts
import prisma from "../prisma";
import { Prisma } from "@prisma/client";

export type ProductoCompraKey = {
  id_compra: number;
  id_producto: number;
};

// Todos los productos_compra (opcional filtrar por id_compra)
export async function getAllProductoCompra(id_compra?: number) {
  return prisma.producto_compra.findMany({
    where: id_compra ? { id_compra } : undefined,
    include: {
      producto: true,
      compra: true,
    },
  });
}

// Uno solo por PK compuesta
export async function getProductoCompra(key: ProductoCompraKey) {
  return prisma.producto_compra.findUnique({
    where: {
      id_producto_id_compra: {
        id_compra: key.id_compra,
        id_producto: key.id_producto,
      },
    },
    include: {
      producto: true,
      compra: true,
    },
  });
}

// Crear detalle de compra
export async function createProductoCompra(data: {
  id_compra: number;
  id_producto: number;
  cantidad_compra: number;
  costo_unitario: number | string;
  subtotal?: number | string;
}) {
  const subtotal =
    data.subtotal ??
    Number(data.cantidad_compra) * Number(data.costo_unitario);

  return prisma.producto_compra.create({
    data: {
      id_compra: data.id_compra,
      id_producto: data.id_producto,
      cantidad_compra: data.cantidad_compra,
      costo_unitario: new Prisma.Decimal(data.costo_unitario),
      subtotal: new Prisma.Decimal(subtotal),
    },
  });
}

// Actualizar detalle de compra
export async function updateProductoCompra(
  key: ProductoCompraKey,
  data: {
    cantidad_compra?: number;
    costo_unitario?: number | string;
    subtotal?: number | string;
  }
) {
  const updateData: any = {};

  if (data.cantidad_compra !== undefined) {
    updateData.cantidad_compra = data.cantidad_compra;
  }
  if (data.costo_unitario !== undefined) {
    updateData.costo_unitario = new Prisma.Decimal(data.costo_unitario);
  }

  // Si viene subtotal lo usamos, si no y hay cantidad+costo, lo recalculamos
  if (data.subtotal !== undefined) {
    updateData.subtotal = new Prisma.Decimal(data.subtotal);
  } else if (
    data.cantidad_compra !== undefined &&
    data.costo_unitario !== undefined
  ) {
    updateData.subtotal = new Prisma.Decimal(
      Number(data.cantidad_compra) * Number(data.costo_unitario)
    );
  }

  return prisma.producto_compra.update({
    where: {
      id_producto_id_compra: {
        id_compra: key.id_compra,
        id_producto: key.id_producto,
      },
    },
    data: updateData,
  });
}

// Eliminar detalle de compra
export async function deleteProductoCompra(key: ProductoCompraKey) {
  return prisma.producto_compra.delete({
    where: {
      id_producto_id_compra: {
        id_compra: key.id_compra,
        id_producto: key.id_producto,
      },
    },
  });
}
