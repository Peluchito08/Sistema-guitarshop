// guitarshop-backend/lib/services/facturaService.ts
import prisma from "../prisma";
import { Prisma } from "../../generated/prisma/client";

const facturaSelectBase = {
  id_factura: true,
  numero_factura: true,
  fecha_factura: true,
  id_cliente: true,
  id_usuario: true,
  observacion: true,
  forma_pago: true,
  subtotal: true,
  impuesto: true,
  total: true,
  id_estado: true,
} as const;

const facturaDetalleSelect = {
  ...facturaSelectBase,
  cliente: {
    select: {
      id_cliente: true,
      nombres: true,
      apellidos: true,
      cedula: true,
    },
  },
  usuario: {
    select: {
      id_usuario: true,
      nombre_completo: true,
    },
  },
  detalle_factura: {
    select: {
      id_detalle_factura: true,
      id_producto: true,
      cantidad: true,
      precio_unitario: true,
      descuento: true,
      subtotal: true,
      producto: {
        select: {
          codigo_producto: true,
          nombre_producto: true,
        },
      },
    },
  },
  credito: {
    select: {
      id_credito: true,
      monto_total: true,
      saldo_pendiente: true,
      fecha_inicio: true,
      fecha_fin: true,
      cuota: {
        select: {
          id_cuota: true,
          numero_cuota: true,
          fecha_vencimiento: true,
          monto_cuota: true,
          monto_pagado: true,
          estado_cuota: true,
        },
        orderBy: { numero_cuota: "asc" },
      },
    },
  },
} as const;

type DetalleVentaInput = {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number; // valor monetario opcional
};

type CreditoConfigInput = {
  numero_cuotas: number;
  fecha_primer_vencimiento: string; // ISO: "2025-12-10"
  dias_entre_cuotas?: number;       // por defecto 30
};

// ==========================
// LISTAR VENTAS (facturas)
// ==========================
export async function listarVentas() {
  const facturas = await prisma.factura.findMany({
    select: {
      ...facturaSelectBase,
      cliente: {
        select: {
          id_cliente: true,
          nombres: true,
          apellidos: true,
          cedula: true,
        },
      },
      usuario: {
        select: {
          id_usuario: true,
          nombre_completo: true,
        },
      },
    },
    orderBy: { id_factura: "desc" },
  });

  return facturas;
}

// ==========================
// OBTENER VENTA POR ID
// ==========================
export async function obtenerVentaPorId(id: number) {
  const factura = await prisma.factura.findUnique({
    where: { id_factura: id },
    select: facturaDetalleSelect,
  });

  return factura;
}

// ==========================
// CREAR VENTA / FACTURA
// ==========================
export async function crearVenta(data: {
  id_cliente: number;
  id_usuario: number; // viene del token
  forma_pago: "CONTADO" | "CREDITO";
  observacion?: string | null;
  detalle: DetalleVentaInput[];
  creditoConfig?: CreditoConfigInput;
  id_usuario_modifi?: number | null;
}) {
  if (!data.detalle || data.detalle.length === 0) {
    throw new Error("DETALLE_VACIO");
  }

  // 1) Calcular subtotales y totales
  let subtotalFactura = 0;

  const itemsCalculados = data.detalle.map((item) => {
    const descuento = item.descuento ?? 0;
    const subtotal = item.precio_unitario * item.cantidad - descuento;
    subtotalFactura += subtotal;

    return {
      ...item,
      descuento,
      subtotal,
    };
  });

  const IVA = 0.15; // 15% IVA
  const impuesto = Number((subtotalFactura * IVA).toFixed(2));
  const total = Number((subtotalFactura + impuesto).toFixed(2));

  // 2) Lógica en transacción
  const resultado = await prisma.$transaction(async (tx) => {
    // 2.1) Verificar stock antes de crear
    for (const item of itemsCalculados) {
      const producto = await tx.producto.findUnique({
        where: { id_producto: item.id_producto },
        select: { cantidad_stock: true, nombre_producto: true },
      });

      if (!producto) {
        throw new Error(`PRODUCTO_NO_ENCONTRADO_${item.id_producto}`);
      }

      if (producto.cantidad_stock < item.cantidad) {
        throw new Error(
          `STOCK_INSUFICIENTE_${item.id_producto}_${producto.nombre_producto}`
        );
      }
    }

    // 2.2) Generar número de factura sencillo
    // (Puedes mejorarlo luego con serie, etc.)
    const ultima = await tx.factura.findFirst({
      orderBy: { id_factura: "desc" },
      select: { id_factura: true },
    });
    const siguienteNumero =
      (ultima?.id_factura ?? 0) + 1;
    const numero_factura = `F-${siguienteNumero.toString().padStart(6, "0")}`;

    // 2.3) Crear factura (cabecera)
    const nuevaFactura = await tx.factura.create({
      data: {
        numero_factura,
        id_cliente: data.id_cliente,
        id_usuario: data.id_usuario,
        observacion: data.observacion ?? null,
        forma_pago: data.forma_pago,
        subtotal: subtotalFactura,
        impuesto,
        total,
        id_estado: 1,
        id_usuario_modifi: data.id_usuario_modifi ?? null,
      },
    });

    // 2.4) Crear detalle + bajar stock + kardex SALIDA
    for (const item of itemsCalculados) {
      await tx.detalle_factura.create({
        data: {
          id_factura: nuevaFactura.id_factura,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          id_estado: 1,
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        },
      });

      // bajar stock
      await tx.producto.update({
        where: { id_producto: item.id_producto },
        data: {
          cantidad_stock: {
            decrement: item.cantidad,
          },
        },
      });

      // kardex
      await tx.kardex.create({
        data: {
          id_producto: item.id_producto,
          tipo_movimiento: "SALIDA",
          origen: "VENTA",
          id_referencia: nuevaFactura.id_factura,
          cantidad: item.cantidad,
          costo_unitario: item.precio_unitario,
          comentario: data.observacion ?? null,
          id_estado: 1,
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        },
      });
    }

    // 2.5) Si es crédito, crear credito + cuotas
    if (data.forma_pago === "CREDITO") {
      if (!data.creditoConfig) {
        throw new Error("CREDITO_SIN_CONFIG");
      }

      const { numero_cuotas, fecha_primer_vencimiento, dias_entre_cuotas } =
        data.creditoConfig;

      if (!numero_cuotas || numero_cuotas <= 0) {
        throw new Error("NUMERO_CUOTAS_INVALIDO");
      }

      const fechaInicio = new Date();
      const fechaPrimera = new Date(fecha_primer_vencimiento);
      const intervaloDias = dias_entre_cuotas ?? 30;

      const credito = await tx.credito.create({
        data: {
          id_factura: nuevaFactura.id_factura,
          monto_total: total,
          saldo_pendiente: total,
          fecha_inicio: fechaInicio,
          fecha_fin: null,
          id_estado: 1,
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        },
      });

      // Generar cuotas simples iguales
      const montoPorCuota = Number((total / numero_cuotas).toFixed(2));
      const cuotasData = [];

      for (let i = 0; i < numero_cuotas; i++) {
        const fechaVenc = new Date(fechaPrimera);
        fechaVenc.setDate(
          fechaVenc.getDate() + i * intervaloDias
        );

        cuotasData.push({
          id_credito: credito.id_credito,
          numero_cuota: i + 1,
          fecha_vencimiento: fechaVenc,
          monto_cuota: montoPorCuota,
          monto_pagado: 0,
          estado_cuota: "PENDIENTE",
          id_usuario_modifi: data.id_usuario_modifi ?? null,
        });
      }

      await tx.cuota.createMany({
        data: cuotasData,
      });
    }

    // 2.6) Devolver factura completa
    const facturaCompleta = await tx.factura.findUnique({
      where: { id_factura: nuevaFactura.id_factura },
      select: facturaDetalleSelect,
    });

    return facturaCompleta;
  });

  return resultado;
}

// ==========================
// ACTUALIZAR OBSERVACIÓN
// ==========================
export async function actualizarVenta(dataId: number, data: {
  observacion?: string | null;
  id_usuario_modifi?: number | null;
}) {
  const existe = await prisma.factura.findUnique({
    where: { id_factura: dataId },
    select: { id_factura: true },
  });

  if (!existe) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Usamos UncheckedUpdateInput para poder asignar directamente el FK opcional
  // (Prisma omite algunos campos FK en el UpdateInput “checked”).
  const updateData: Prisma.facturaUncheckedUpdateInput = {};

  if (data.observacion !== undefined) {
    const obs = data.observacion?.trim();
    updateData.observacion = obs && obs.length > 0 ? obs : null;
  }

  if (data.id_usuario_modifi !== undefined) {
    updateData.id_usuario_modifi = data.id_usuario_modifi;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.factura.update({
      where: { id_factura: dataId },
      data: updateData,
    });
  }

  return obtenerVentaPorId(dataId);
}

// ==========================
// ANULAR VENTA (restituir stock)
// ==========================
export async function anularVenta(
  id: number,
  id_usuario_modifi?: number | null
) {
  const estadoAnulado = await prisma.estado_registro.findFirst({
    where: { nombre_estado: "ANULADO" },
    select: { id_estado: true },
  });

  if (!estadoAnulado) {
    throw new Error("ESTADO_ANULADO_NO_CONFIGURADO");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const factura = await tx.factura.findUnique({
      where: { id_factura: id },
      select: {
        id_factura: true,
        numero_factura: true,
        id_estado: true,
        detalle_factura: {
          select: {
            id_producto: true,
            cantidad: true,
            precio_unitario: true,
          },
        },
        credito: {
          select: { id_credito: true },
        },
      },
    });

    if (!factura) {
      throw new Error("VENTA_NO_ENCONTRADA");
    }

    if (factura.id_estado === estadoAnulado.id_estado) {
      throw new Error("VENTA_YA_ANULADA");
    }

    for (const item of factura.detalle_factura) {
      await tx.producto.update({
        where: { id_producto: item.id_producto },
        data: {
          cantidad_stock: {
            increment: item.cantidad,
          },
        },
      });

      await tx.kardex.create({
        data: {
          id_producto: item.id_producto,
          tipo_movimiento: "ENTRADA",
          origen: "AJUSTE",
          id_referencia: factura.id_factura,
          cantidad: item.cantidad,
          costo_unitario: item.precio_unitario,
          comentario: `Reverso de ${factura.numero_factura}`,
          id_estado: 1,
          id_usuario_modifi: id_usuario_modifi ?? null,
        },
      });
    }

    if (factura.credito.length > 0) {
      await tx.credito.deleteMany({
        where: { id_factura: factura.id_factura },
      });
    }

    await tx.detalle_factura.updateMany({
      where: { id_factura: factura.id_factura },
      data: {
        id_estado: estadoAnulado.id_estado,
        id_usuario_modifi: id_usuario_modifi ?? null,
      },
    });

    await tx.factura.update({
      where: { id_factura: factura.id_factura },
      data: {
        id_estado: estadoAnulado.id_estado,
        id_usuario_modifi: id_usuario_modifi ?? null,
      },
    });

    return tx.factura.findUnique({
      where: { id_factura: factura.id_factura },
      select: facturaDetalleSelect,
    });
  });

  return resultado;
}
