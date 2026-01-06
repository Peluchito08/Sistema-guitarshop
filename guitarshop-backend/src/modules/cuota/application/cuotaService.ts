import prisma from "../../../shared/prisma/prismaClient";

// ==========================
// OBTENER TODAS LAS CUOTAS
// ==========================
export async function obtenerTodasLasCuotas() {
  const cuotas = await prisma.cuota.findMany({
    select: cuotaSelect,
    orderBy: { id_cuota: "asc" },
  });

  return cuotas;
}

// Lo que devolvemos al frontend
const cuotaSelect = {
  id_cuota: true,
  id_credito: true,
  numero_cuota: true,
  fecha_vencimiento: true,
  monto_cuota: true,
  monto_pagado: true,
  estado_cuota: true,
  fecha_pago: true,
} as const;

// ==========================
// OBTENER CUOTA + CREDITO + FACTURA + CLIENTE
// ==========================
export async function obtenerCuotaDetallePorId(id_cuota: number) {
  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: {
      credito: {
        include: {
          factura: {
            include: {
              cliente: true,
            },
          },
        },
      },
    },
  });

  return cuota;
}

// ==========================
// PAGO DE CUOTA
// ==========================
// montoPago = cuánto está pagando el cliente en este momento
export async function pagarCuota(params: {
  id_cuota: number;
  montoPago: number;
  id_usuario_modifi: number;
}) {
  const { id_cuota, montoPago, id_usuario_modifi } = params;

  if (montoPago <= 0) {
    throw new Error("MONTO_INVALIDO");
  }

  // Traemos la cuota + el crédito relacionado
  const cuota = await prisma.cuota.findUnique({
    where: { id_cuota },
    include: {
      credito: true,
    },
  });

  if (!cuota) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  if (cuota.estado_cuota === "PAGADA") {
    throw new Error("CUOTA_YA_PAGADA");
  }

  const montoCuota = Number(cuota.monto_cuota);
  const montoPagadoActual = Number(cuota.monto_pagado);
  const saldoCuota = montoCuota - montoPagadoActual;

  if (montoPago > saldoCuota) {
    // no dejamos pagar más de lo que debe esa cuota
    throw new Error("MONTO_SUPERA_SALDO_CUOTA");
  }

  const nuevoMontoPagado = montoPagadoActual + montoPago;

  // Definimos estado de la cuota
  let nuevoEstado = "PENDIENTE";
  let fecha_pago: Date | null = null;

  if (nuevoMontoPagado === montoCuota) {
    nuevoEstado = "PAGADA";
    fecha_pago = new Date();
  } else if (nuevoMontoPagado > 0 && nuevoMontoPagado < montoCuota) {
    nuevoEstado = "PENDIENTE";
    // puedes decidir si guardar fecha_pago o no en parcial
    fecha_pago = null;
  }

  // Actualizamos dentro de una transacción: cuota + crédito
  const resultado = await prisma.$transaction(async (tx) => {
    // 1) Actualizar cuota
    const cuotaActualizada = await tx.cuota.update({
      where: { id_cuota },
      data: {
        monto_pagado: nuevoMontoPagado,
        estado_cuota: nuevoEstado,
        fecha_pago,
        id_usuario_modifi,
      },
      select: cuotaSelect,
    });

    // 2) Actualizar saldo del crédito
    const credito = await tx.credito.findUnique({
      where: { id_credito: cuota.id_credito },
    });

    if (!credito) {
      throw new Error("CREDITO_NO_ENCONTRADO");
    }

    const saldoActual = Number(credito.saldo_pendiente);
    const nuevoSaldo = saldoActual - montoPago;

    const creditoActualizado = await tx.credito.update({
      where: { id_credito: credito.id_credito },
      data: {
        saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
        // si ya no hay saldo, ponemos fecha_fin
        fecha_fin: nuevoSaldo <= 0 ? new Date() : credito.fecha_fin,
        id_usuario_modifi,
      },
    });

    return {
      cuota: cuotaActualizada,
      credito: {
        id_credito: creditoActualizado.id_credito,
        saldo_pendiente: creditoActualizado.saldo_pendiente,
        fecha_fin: creditoActualizado.fecha_fin,
      },
    };
  });

  return resultado;
}
