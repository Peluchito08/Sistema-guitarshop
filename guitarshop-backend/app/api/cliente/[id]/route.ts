// guitarshop-backend/app/api/clientes/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import {
  obtenerClientePorId,
  actualizarCliente,
  eliminarCliente,
} from "../../../../lib/services/clienteService";

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

// GET /api/clientes/:id
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
      { error: "Solo administradores pueden acceder a clientes" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const cliente = await obtenerClientePorId(id);
    if (!cliente) {
      return jsonCors({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return jsonCors(cliente, { status: 200 });
  } catch (error) {
    console.error("Error GET /clientes/:id", error);
    return jsonCors(
      { error: "Error al obtener cliente" },
      { status: 500 }
    );
  }
}

// PUT /api/clientes/:id
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
      { error: "Solo administradores pueden actualizar clientes" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();

    const cliente = await actualizarCliente(id, {
      nombres: body.nombres,
      apellidos: body.apellidos,
      cedula: body.cedula,
      correo: body.correo,
      telefono: body.telefono,
      direccion: body.direccion,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(cliente, { status: 200 });
  } catch (error: unknown) {
    console.error("Error PUT /clientes/:id", error);

    if (error instanceof Error && error.message === "CLIENTE_DUPLICADO") {
      return jsonCors(
        { error: "La cédula o correo ya están registrados para otro cliente" },
        { status: 400 }
      );
    }

    return jsonCors(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    );
  }
}

// DELETE /api/clientes/:id
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
      { error: "Solo administradores pueden eliminar clientes" },
      { status: 403 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const cliente = await eliminarCliente(id);
    return jsonCors(cliente, { status: 200 });
  } catch (error) {
    console.error("Error DELETE /clientes/:id", error);
    return jsonCors(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}
