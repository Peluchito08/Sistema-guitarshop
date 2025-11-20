// app/api/productos/route.ts
import prisma from "../../../lib/prisma";
import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";

// Preflight CORS
export async function OPTIONS() {
  return optionsCors();
}

// GET /api/productos  -> listar productos (PROTEGIDO)
export async function GET(request: Request) {
  const validation = verifyToken(request);

  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  try {
    const productos = await prisma.producto.findMany({
      orderBy: { id_producto: "asc" },
    });

    return jsonCors(productos);
  } catch (error) {
    console.error("Error GET /productos:", error);
    return jsonCors(
      { message: "Error al obtener productos", error: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/productos -> crear nuevo producto (PROTEGIDO)
export async function POST(request: Request) {
  const validation = verifyToken(request);

  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validaciones básicas del body
    if (
      !body.id_proveedor ||
      !body.nombre_producto ||
      body.precio == null ||
      body.cantidad_stock == null ||
      body.id_estado == null
    ) {
      return jsonCors(
        { message: "Faltan datos obligatorios del producto" },
        { status: 400 }
      );
    }

    const now = new Date();

    const nuevoProducto = await prisma.producto.create({
      data: {
        id_proveedor: Number(body.id_proveedor),
        nombre_producto: String(body.nombre_producto),
        descripcion: body.descripcion ?? null,
        precio: body.precio,
        cantidad_stock: Number(body.cantidad_stock),
        foto: body.foto ?? null,
        fecha: body.fecha ? new Date(body.fecha) : now,
        fecha_creacion: now,
        id_estado: Number(body.id_estado),
        id_usuario_modifi: body.id_usuario_modifi
          ? Number(body.id_usuario_modifi)
          : null,
      },
    });

    return jsonCors(nuevoProducto, { status: 201 });
  } catch (error) {
    console.error("Error POST /productos:", error);
    return jsonCors(
      { message: "Error al crear producto", error: String(error) },
      { status: 500 }
    );
  }
}
