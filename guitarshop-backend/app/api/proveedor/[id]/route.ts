// guitarshop-backend/app/api/proveedor/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import {
  obtenerProveedorPorId,
  actualizarProveedor,
  eliminarProveedor,
} from "../../../../lib/services/proveedorService";

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

// GET /api/proveedor/:id
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  if (!hasAdminRole(auth)) {
    return jsonCors(
      { error: "Solo administradores pueden acceder a proveedores" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const proveedor = await obtenerProveedorPorId(id);
    if (!proveedor) {
      return jsonCors({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    return jsonCors(proveedor, { status: 200 });
  } catch (error) {
    console.error("Error GET /proveedor/:id", error);
    return jsonCors(
      { error: "Error al obtener proveedor" },
      { status: 500 }
    );
  }
}

// PUT /api/proveedor/:id
export async function PUT(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  if (!hasAdminRole(auth)) {
    return jsonCors(
      { error: "Solo administradores pueden actualizar proveedores" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const proveedor = await actualizarProveedor(id, {
      nombre_proveedor: body.nombre_proveedor,
      ruc_cedula: body.ruc_cedula,
      correo: body.correo,
      telefono: body.telefono,
      direccion: body.direccion,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(proveedor, { status: 200 });
  } catch (error: unknown) {
    console.error("Error PUT /proveedor/:id", error);

    if (error instanceof Error && error.message === "PROVEEDOR_DUPLICADO") {
      return jsonCors(
        { error: "El RUC/Cédula ya está registrado para otro proveedor" },
        { status: 400 }
      );
    }

    return jsonCors(
      { error: "Error al actualizar proveedor" },
      { status: 500 }
    );
  }
}

// DELETE /api/proveedor/:id
export async function DELETE(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  if (!hasAdminRole(auth)) {
    return jsonCors(
      { error: "Solo administradores pueden eliminar proveedores" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const proveedor = await eliminarProveedor(id);
    return jsonCors(proveedor, { status: 200 });
  } catch (error: unknown) {
    console.error("Error DELETE /proveedor/:id", error);

    if (error instanceof Error && error.message === "PROVEEDOR_CON_RELACIONES") {
      return jsonCors(
        {
          error:
            "No se puede eliminar el proveedor porque tiene productos o compras asociadas.",
        },
        { status: 409 }
      );
    }

    return jsonCors(
      { error: "Error al eliminar proveedor" },
      { status: 500 }
    );
  }
}
