import prisma from "../../../shared/prisma/prismaClient";

// Siempre consultamos el crédito completo (factura + cuotas) para que el frontend pueda armar dashboards.
const creditoSelect = {
  id_credito: true,
  id_factura: true,
  monto_total: true,
  saldo_pendiente: true,
  fecha_inicio: true,
  fecha_fin: true,
  id_estado: true,
  factura: {
    select: {
      id_factura: true,
      numero_factura: true,
      total: true,
      cliente: {
        select: {
          id_cliente: true,
          nombres: true,
          apellidos: true,
          cedula: true,
        },
      },
    },
  },
  cuota: {
    select: {
      id_cuota: true,
      numero_cuota: true,
      fecha_vencimiento: true,
      monto_cuota: true,
      monto_pagado: true,
      estado_cuota: true,
      fecha_pago: true,
    },
    orderBy: { numero_cuota: "asc" },
  },
} as const;

// ==========================
// LISTAR TODOS LOS CRÉDITOS
// ==========================
export async function obtenerCreditos() {
  const creditos = await prisma.credito.findMany({
    select: creditoSelect,
    orderBy: { id_credito: "desc" },
  });

  return creditos;
}

// ==========================
// OBTENER CRÉDITO POR ID
// ==========================
export async function obtenerCreditoPorId(id_credito: number) {
  const credito = await prisma.credito.findUnique({
    where: { id_credito },
    select: creditoSelect,
  });

  return credito; // puede ser null
}
