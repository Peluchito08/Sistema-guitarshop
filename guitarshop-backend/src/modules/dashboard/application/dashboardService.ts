import prisma from "../../../shared/prisma/prismaClient";

type DateRange = { start: Date; end: Date };

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
};

const percentChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
};

async function getSalesSnapshot(range: DateRange) {
  const [orders, totals] = await Promise.all([
    prisma.factura.count({
      where: { fecha_factura: { gte: range.start, lt: range.end } },
    }),
    prisma.factura.aggregate({
      _sum: { total: true },
      where: { fecha_factura: { gte: range.start, lt: range.end } },
    }),
  ]);

  const amount = toNumber(totals._sum.total);
  return {
    amount,
    orders,
    avgTicket: orders === 0 ? 0 : amount / orders,
  };
}

const buildDate = (date: Date, daysToAdd: number) => {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + daysToAdd);
  return clone;
};

export async function obtenerDashboard() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = buildDate(startOfToday, 1);
  const startOfYesterday = buildDate(startOfToday, -1);
  const startOfWeek = buildDate(startOfToday, -6);
  const startOfPreviousWeek = buildDate(startOfWeek, -7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const historyDays = 10;
  const historyStart = buildDate(startOfToday, -(historyDays - 1));

  const summaryPromise = Promise.all([
    prisma.cliente.count(),
    prisma.producto.count(),
    prisma.proveedor.count(),
  ]);

  const totalComprasPromise = prisma.compra.count();

  const [
    salesToday,
    salesPreviousDay,
    salesWeek,
    salesPreviousWeek,
    salesMonth,
    salesPreviousMonth,
  ] = await Promise.all([
    getSalesSnapshot({ start: startOfToday, end: startOfTomorrow }),
    getSalesSnapshot({ start: startOfYesterday, end: startOfToday }),
    getSalesSnapshot({ start: startOfWeek, end: startOfTomorrow }),
    getSalesSnapshot({ start: startOfPreviousWeek, end: startOfWeek }),
    getSalesSnapshot({ start: startOfMonth, end: startOfNextMonth }),
    getSalesSnapshot({ start: startOfPreviousMonth, end: startOfMonth }),
  ]);

  const lowStockPromise = prisma.producto.findMany({
    where: { cantidad_stock: { lt: 8 } },
    select: {
      id_producto: true,
      codigo_producto: true,
      nombre_producto: true,
      cantidad_stock: true,
      stock_minimo: true,
    },
    orderBy: { cantidad_stock: "asc" },
    take: 8,
  });

  const topProductsPromise = prisma.detalle_factura.groupBy({
    by: ["id_producto"],
    _sum: { cantidad: true, subtotal: true },
    where: {
      factura: {
        fecha_factura: { gte: historyStart },
      },
    },
    orderBy: { _sum: { cantidad: "desc" } },
    take: 5,
  });

  const salesHistoryPromise = prisma.factura.findMany({
    where: { fecha_factura: { gte: historyStart } },
    select: { fecha_factura: true, total: true },
    orderBy: { fecha_factura: "asc" },
  });

  const detallesDelMesPromise = prisma.detalle_factura.findMany({
    where: { factura: { fecha_factura: { gte: startOfMonth } } },
    select: {
      cantidad: true,
      subtotal: true,
      producto: {
        select: { precio_compra: true },
      },
    },
  });

  const cuotasVencidasFilter = {
    estado_cuota: { not: "PAGADO" },
    fecha_vencimiento: { lt: startOfToday },
  } as const;

  const cuotasVencidasAggregatePromise = prisma.cuota.aggregate({
    _sum: { monto_cuota: true, monto_pagado: true },
    where: cuotasVencidasFilter,
  });

  const cuotasVencidasCountPromise = prisma.cuota.count({
    where: cuotasVencidasFilter,
  });

  const cuotasVencidasDetallePromise = prisma.cuota.findMany({
    where: cuotasVencidasFilter,
    orderBy: { fecha_vencimiento: "asc" },
    take: 5,
    select: {
      id_cuota: true,
      fecha_vencimiento: true,
      monto_cuota: true,
      monto_pagado: true,
      credito: {
        select: {
          factura: {
            select: {
              numero_factura: true,
              cliente: {
                select: {
                  nombres: true,
                  apellidos: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const creditosActivosPromise = prisma.credito.count({
    where: { saldo_pendiente: { gt: 0 } },
  });

  const creditosSaldoPromise = prisma.credito.aggregate({
    _sum: { saldo_pendiente: true },
    where: { saldo_pendiente: { gt: 0 } },
  });

  const creditosEnRiesgoPromise = prisma.credito.count({
    where: {
      saldo_pendiente: { gt: 0 },
      cuota: {
        some: {
          estado_cuota: { not: "PAGADO" },
          fecha_vencimiento: { lt: startOfToday },
        },
      },
    },
  });

  const [
    [totalClientes, totalProductos, totalProveedores],
    totalCompras,
    lowStockProducts,
    topProductsRaw,
    salesHistoryRaw,
    detallesDelMes,
    cuotasVencidasAggregate,
    cuotasVencidasCount,
    cuotasVencidasDetalle,
    creditosActivos,
    creditosSaldo,
    creditosEnRiesgo,
  ] = await Promise.all([
    summaryPromise,
    totalComprasPromise,
    lowStockPromise,
    topProductsPromise,
    salesHistoryPromise,
    detallesDelMesPromise,
    cuotasVencidasAggregatePromise,
    cuotasVencidasCountPromise,
    cuotasVencidasDetallePromise,
    creditosActivosPromise,
    creditosSaldoPromise,
    creditosEnRiesgoPromise,
  ]);

  const productIds = topProductsRaw.map((item) => item.id_producto);
  const productMap = productIds.length
    ? await prisma.producto.findMany({
        where: { id_producto: { in: productIds } },
        select: {
          id_producto: true,
          nombre_producto: true,
          cantidad_stock: true,
        },
      })
    : [];

  const productLookup = new Map(productMap.map((producto) => [producto.id_producto, producto]));

  const topProducts = topProductsRaw.map((item) => {
    const meta = productLookup.get(item.id_producto);
    return {
      id_producto: item.id_producto,
      nombre_producto: meta?.nombre_producto ?? "Producto sin nombre",
      unidades_vendidas: item._sum.cantidad ?? 0,
      ingresos: toNumber(item._sum.subtotal),
      stock_actual: meta?.cantidad_stock ?? 0,
    };
  });

  const historyEntries = new Map<string, number>();
  for (const factura of salesHistoryRaw) {
    const key = factura.fecha_factura.toISOString().slice(0, 10);
    const prev = historyEntries.get(key) ?? 0;
    historyEntries.set(key, prev + toNumber(factura.total));
  }

  const salesHistory = Array.from({ length: historyDays }, (_, idx) => {
    const day = buildDate(historyStart, idx);
    const key = day.toISOString().slice(0, 10);
    return {
      date: day.toISOString(),
      total: historyEntries.get(key) ?? 0,
    };
  });

  const totalIngresosMes = salesMonth.amount;
  const totalCostosMes = detallesDelMes.reduce((acc, detalle) => {
    const costo = detalle.producto?.precio_compra ? toNumber(detalle.producto.precio_compra) : 0;
    return acc + detalle.cantidad * costo;
  }, 0);
  const totalUtilidadMes = totalIngresosMes - totalCostosMes;
  const margen = totalIngresosMes === 0 ? 0 : totalUtilidadMes / totalIngresosMes;

  const montoVencido =
    toNumber(cuotasVencidasAggregate._sum.monto_cuota) -
    toNumber(cuotasVencidasAggregate._sum.monto_pagado);

  const detalleCuotas = cuotasVencidasDetalle.map((cuota) => {
    const cliente = cuota.credito.factura.cliente;
    const nombre = cliente
      ? `${cliente.nombres ?? ""} ${cliente.apellidos ?? ""}`.trim()
      : "Cliente sin nombre";
    const diasAtraso = Math.max(
      0,
      Math.floor(
        (startOfToday.getTime() - cuota.fecha_vencimiento.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const pendiente = toNumber(cuota.monto_cuota) - toNumber(cuota.monto_pagado);

    return {
      id_cuota: cuota.id_cuota,
      cliente: nombre || "Cliente sin nombre",
      factura: cuota.credito.factura.numero_factura,
      montoPendiente: pendiente,
      diasAtraso,
    };
  });

  return {
    summary: {
      clientes: totalClientes,
      productos: totalProductos,
      proveedores: totalProveedores,
      comprasRegistradas: totalCompras,
    },
    sales: {
      day: {
        ...salesToday,
        delta: percentChange(salesToday.amount, salesPreviousDay.amount),
      },
      week: {
        ...salesWeek,
        delta: percentChange(salesWeek.amount, salesPreviousWeek.amount),
      },
      month: {
        ...salesMonth,
        delta: percentChange(salesMonth.amount, salesPreviousMonth.amount),
      },
    },
    revenue: {
      ingresos: totalIngresosMes,
      utilidad: totalUtilidadMes,
      margen,
      delta: percentChange(salesMonth.amount, salesPreviousMonth.amount),
    },
    salesHistory,
    topProducts,
    lowStock: lowStockProducts,
    credits: {
      activos: creditosActivos,
      montoPendiente: toNumber(creditosSaldo._sum.saldo_pendiente),
      enRiesgo: creditosEnRiesgo,
      cuotasVencidas: cuotasVencidasCount,
      montoVencido,
      detalle: detalleCuotas,
    },
    alerts: {
      stockCritico: lowStockProducts.length,
      cuotasVencidas: cuotasVencidasCount,
    },
  };
}
