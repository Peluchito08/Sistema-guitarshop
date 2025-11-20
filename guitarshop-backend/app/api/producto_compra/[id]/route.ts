import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import { Prisma } from "@prisma/client";
import {
  getProductoCompra,
  updateProductoCompra,
  deleteProductoCompra,
} from "../../../../lib/services/productoCompraService";

function getIdsFromUrl(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/"); // [..., "producto-compra", id_compra, id_producto]
  const id_producto = Number(parts.pop());
  const id_compra = Number(parts.pop());
  if (isNaN(id_compra) || isNaN(id_producto)) return null;
  return { id_compra, id_producto };
}

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/producto-compra/:id_compra/:id_producto
export async function GET(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const ids = getIdsFromUrl(req);
  if (!ids) return jsonCors({ message: "IDs inválidos" }, { status: 400 });

  const detalle = await getProductoCompra(ids);
  if (!detalle)
    return jsonCors({ message: "Detalle no encontrado" }, { status: 404 });

  return jsonCors(detalle);
}

// PUT /api/producto-compra/:id_compra/:id_producto
export async function PUT(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const ids = getIdsFromUrl(req);
  if (!ids) return jsonCors({ message: "IDs inválidos" }, { status: 400 });

  try {
    const body = await req.json();

    const actualizado = await updateProductoCompra(ids, {
      cantidad_compra:
        body.cantidad_compra !== undefined
          ? Number(body.cantidad_compra)
          : undefined,
      costo_unitario: body.costo_unitario,
      subtotal: body.subtotal,
    });

    return jsonCors(actualizado);
  } catch (error: any) {
    console.error("Error PUT /producto-compra", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonCors({ message: "Detalle no encontrado" }, { status: 404 });
    }

    return jsonCors(
      { message: "Error al actualizar detalle", detalle: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/producto-compra/:id_compra/:id_producto
export async function DELETE(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const ids = getIdsFromUrl(req);
  if (!ids) return jsonCors({ message: "IDs inválidos" }, { status: 400 });

  try {
    await deleteProductoCompra(ids);
    return jsonCors({ message: "Detalle eliminado" });
  } catch (error: any) {
    console.error("Error DELETE /producto-compra", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return jsonCors({ message: "Detalle no encontrado" }, { status: 404 });
    }

    return jsonCors(
      { message: "Error al eliminar detalle", detalle: String(error) },
      { status: 500 }
    );
  }
}
