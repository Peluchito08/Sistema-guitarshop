import prisma from "../../../shared/prisma/prismaClient";

const compraSelectBase = {
  id_compra: true,
  fecha_compra: true,
  id_proveedor: true,
  id_usuario: true,
  observacion: true,
  subtotal: true,
  impuesto: true,
  total: true,
  id_estado: true,
} as const;

// ==========================
// LISTAR COMPRAS
// ==========================
export async function listarCompras() {
  const compras = await prisma.compra.findMany({
    select: {
      ...compraSelectBase,
      proveedor: {
        select: {
          id_proveedor: true,
          nombre_proveedor: true,
        },
      },
      usuario: {
        select: {
          id_usuario: true,
          nombre_completo: true,
        },
      },
    },
    orderBy: { id_compra: "desc" },
  });

  return compras;
}

// ==========================
// OBTENER COMPRA POR ID (con detalle)
// ==========================
export async function obtenerCompraPorId(id: number) {
  const compra = await prisma.compra.findUnique({
    where: { id_compra: id },
    select: {
      ...compraSelectBase,
      proveedor: {
        select: {
          id_proveedor: true,
          nombre_proveedor: true,
        },
      },
      usuario: {
        select: {
          id_usuario: true,
          nombre_completo: true,
        },
      },
      producto_compra: {
        select: {
          id_producto_compra: true,
          id_producto: true,
          cantidad_compra: true,
          costo_unitario: true,
          subtotal: true,
          producto: {
            select: {
              nombre_producto: true,
              codigo_producto: true,
            },
          },
        },
      },
    },
  });

  return compra;
}

// ==========================
// CREAR COMPRA COMPLETA
// ==========================
type DetalleCompraInput = {
  id_producto: number;
  cantidad: number;
  costo_unitario: number;
};

export async function crearCompra(data: {
  id_proveedor: number;
  id_usuario: number; // viene del token
  observacion?: string | null;
  detalle: DetalleCompraInput[];
  id_usuario_modifi?: number | null;
}) {
  if (!data.detalle || data.detalle.length === 0) {
    throw new Error("DETALLE_VACIO");
  }

  // Calcular totales
  let subtotal = 0;
  const itemsCalculados = data.detalle.map((item) => {
    const sub = item.cantidad * item.costo_unitario;
    subtotal += sub;
    return { ...item, subtotal: sub };
  });

  const IVA = 0.15; // 15% IVA segun nuevo requerimiento
  const impuesto = Number((subtotal * IVA).toFixed(2));
  const total = Number((subtotal + impuesto).toFixed(2));

  // Transacción: compra + detalle + stock + kardex
  const resultado = await prisma.$transaction(async (tx) => {
    // 1) Crear cabecera de compra
    const nuevaCompra = await tx.compra.create({
      data: {
        id_proveedor: data.id_proveedor,
        id_usuario: data.id_usuario,
        observacion: data.observacion ?? null,
        subtotal,
        impuesto,
        total,
        id_estado: 1,
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
    });

    // 2) Crear detalle producto_compra
    for (const item of itemsCalculados) {
      await tx.producto_compra.create({
        data: {
          id_compra: nuevaCompra.id_compra,
          id_producto: item.id_producto,
          cantidad_compra: item.cantidad,
          costo_unitario: item.costo_unitario,
          subtotal: item.subtotal,
          id_estado: 1,
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        },
      });

      // 3) Actualizar stock de producto
      await tx.producto.update({
        where: { id_producto: item.id_producto },
        data: {
          cantidad_stock: {
            increment: item.cantidad,
          },
          // opcional: actualizar último costo de compra
          precio_compra: item.costo_unitario,
        },
      });

      // 4) Registrar movimiento en kardex
      await tx.kardex.create({
        data: {
          id_producto: item.id_producto,
          tipo_movimiento: "ENTRADA",
          origen: "COMPRA",
          id_referencia: nuevaCompra.id_compra,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario,
          comentario: data.observacion ?? null,
          id_estado: 1,
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        },
      });
    }

    // 5) Devolver compra con detalle
    const compraCompleta = await tx.compra.findUnique({
      where: { id_compra: nuevaCompra.id_compra },
      select: {
        ...compraSelectBase,
        proveedor: {
          select: {
            id_proveedor: true,
            nombre_proveedor: true,
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombre_completo: true,
          },
        },
        producto_compra: {
          select: {
            id_producto_compra: true,
            id_producto: true,
            cantidad_compra: true,
            costo_unitario: true,
            subtotal: true,
            producto: {
              select: {
                nombre_producto: true,
                codigo_producto: true,
              },
            },
          },
        },
      },
    });

    return compraCompleta;
  });

  return resultado;
}
