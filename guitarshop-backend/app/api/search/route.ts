import { jsonCors, optionsCors } from "../../../lib/cors"
import { verifyToken } from "../../../lib/auth"
import prisma from "../../../lib/prisma"

const emptyResponse = { productos: [], clientes: [], facturas: [] }

export async function OPTIONS() {
  return optionsCors()
}

export async function GET(req: Request) {
  const auth = verifyToken(req)
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 })
  }

  const url = new URL(req.url)
  const query = url.searchParams.get("q")?.trim()

  if (!query || query.length < 2) {
    return jsonCors(emptyResponse, { status: 200 })
  }

  try {
    const [productos, clientes, facturas] = await Promise.all([
      prisma.producto.findMany({
        where: {
          OR: [
            { nombre_producto: { contains: query, mode: "insensitive" } },
            { codigo_producto: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id_producto: true,
          nombre_producto: true,
          codigo_producto: true,
          precio_venta: true,
          cantidad_stock: true,
        },
        orderBy: { nombre_producto: "asc" },
        take: 5,
      }),
      prisma.cliente.findMany({
        where: {
          OR: [
            { nombres: { contains: query, mode: "insensitive" } },
            { apellidos: { contains: query, mode: "insensitive" } },
            { cedula: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id_cliente: true,
          nombres: true,
          apellidos: true,
          cedula: true,
          telefono: true,
        },
        orderBy: { nombres: "asc" },
        take: 5,
      }),
      prisma.factura.findMany({
        where: {
          OR: [
            { numero_factura: { contains: query, mode: "insensitive" } },
            {
              cliente: {
                OR: [
                  { nombres: { contains: query, mode: "insensitive" } },
                  { apellidos: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          ],
        },
        select: {
          id_factura: true,
          numero_factura: true,
          fecha_factura: true,
          total: true,
          forma_pago: true,
          cliente: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
        orderBy: { fecha_factura: "desc" },
        take: 5,
      }),
    ])

    return jsonCors(
      {
        productos: productos.map((producto) => ({
          ...producto,
          precio_venta: Number(producto.precio_venta ?? 0),
          cantidad_stock: Number(producto.cantidad_stock ?? 0),
        })),
        clientes,
        facturas: facturas.map((factura) => ({
          ...factura,
          total: Number(factura.total ?? 0),
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error GET /search:", error)
    return jsonCors({ error: "No se pudo completar la búsqueda" }, { status: 500 })
  }
}