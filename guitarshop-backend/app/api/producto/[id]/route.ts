// guitarshop-backend/app/api/producto/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import {
  obtenerProductoPorId,
  actualizarProducto,
  eliminarProducto,
} from "../../../../lib/services/productoService";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/producto/:id
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const producto = await obtenerProductoPorId(id);
    if (!producto) {
      return jsonCors({ error: "Producto no encontrado" }, { status: 404 });
    }

    return jsonCors(producto, { status: 200 });
  } catch (error) {
    console.error("Error GET /producto/:id", error);
    return jsonCors(
      { error: "Error al obtener producto" },
      { status: 500 }
    );
  }
}

// PUT /api/producto/:id
export async function PUT(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const producto = await actualizarProducto(id, {
      codigo_producto: body.codigo_producto,
      nombre_producto: body.nombre_producto,
      descripcion: body.descripcion,
      id_proveedor: body.id_proveedor,
      precio_compra: body.precio_compra,
      precio_venta: body.precio_venta,
      cantidad_stock: body.cantidad_stock,
      stock_minimo: body.stock_minimo,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(producto, { status: 200 });
  } catch (error: unknown) {
    console.error("Error PUT /producto/:id", error);

    if (error instanceof Error) {
      if (error.message === "PRODUCTO_DUPLICADO") {
        return jsonCors(
          { error: "El código de producto ya está registrado" },
          { status: 400 }
        );
      }
      if (error.message === "PROVEEDOR_REQUERIDO") {
        return jsonCors(
          { error: "Debes seleccionar un proveedor" },
          { status: 400 }
        );
      }
    }

    return jsonCors(
      { error: "Error al actualizar producto" },
      { status: 500 }
    );
  }
}

// DELETE /api/producto/:id
export async function DELETE(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const producto = await eliminarProducto(id);
    return jsonCors(producto, { status: 200 });
  } catch (error: unknown) {
    console.error("Error DELETE /producto/:id", error);

    if (error instanceof Error && error.message === "PRODUCTO_CON_RELACIONES") {
      return jsonCors(
        {
          error:
            "No se puede eliminar el producto porque tiene compras, ventas o movimientos de kardex asociados.",
        },
        { status: 409 }
      );
    }

    return jsonCors(
      { error: "Error al eliminar producto" },
      { status: 500 }
    );
  }
}
