// app/api/productos/[id]/route.ts
import prisma from "../../../../lib/prisma";
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/productos/:id
export async function GET(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const producto = await prisma.producto.findUnique({
      where: { id_producto: id },
    });

    if (!producto) {
      return jsonCors({ message: "Producto no encontrado" }, { status: 404 });
    }

    return jsonCors(producto);
  } catch (error) {
    console.error("Error GET /productos/:id:", error);
    return jsonCors(
      { message: "Error al obtener producto", error: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/productos/:id
export async function PUT(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const productoActualizado = await prisma.producto.update({
      where: { id_producto: id },
      data: {
        id_proveedor:
          body.id_proveedor !== undefined
            ? Number(body.id_proveedor)
            : undefined,
        nombre_producto:
          body.nombre_producto !== undefined
            ? String(body.nombre_producto)
            : undefined,
        descripcion:
          body.descripcion !== undefined ? body.descripcion : undefined,
        precio: body.precio !== undefined ? body.precio : undefined,
        cantidad_stock:
          body.cantidad_stock !== undefined
            ? Number(body.cantidad_stock)
            : undefined,
        foto: body.foto !== undefined ? body.foto : undefined,
        fecha:
          body.fecha !== undefined ? new Date(body.fecha) : undefined,
        id_estado:
          body.id_estado !== undefined ? Number(body.id_estado) : undefined,
        id_usuario_modifi:
          body.id_usuario_modifi !== undefined
            ? Number(body.id_usuario_modifi)
            : undefined,
      },
    });

    return jsonCors(productoActualizado);
  } catch (error) {
    console.error("Error PUT /productos/:id:", error);
    return jsonCors(
      { message: "Error al actualizar producto", error: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/productos/:id
export async function DELETE(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ message: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.producto.delete({
      where: { id_producto: id },
    });

    return jsonCors({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error DELETE /productos/:id:", error);
    return jsonCors(
      { message: "Error al eliminar producto", error: String(error) },
      { status: 500 }
    );
  }
}
