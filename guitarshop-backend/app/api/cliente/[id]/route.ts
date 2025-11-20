import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
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

// GET /api/cliente/:id
export async function GET(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: "No autorizado" }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) return jsonCors({ error: "ID inválido" }, { status: 400 });

  try {
    const cliente = await obtenerClientePorId(id);
    if (!cliente)
      return jsonCors({ error: "Cliente no encontrado" }, { status: 404 });

    return jsonCors(cliente, { status: 200 });
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    return jsonCors({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PUT /api/cliente/:id
export async function PUT(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: "No autorizado" }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) return jsonCors({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();

    const actualizado = await actualizarCliente(id, {
      nombre: body.nombre,
      cedula: body.cedula,
      correo: body.correo,
      telefono: body.telefono,
      direccion: body.direccion,
      id_estado: body.id_estado,
      id_usuario_modifi: body.id_usuario_modifi,
      fecha: body.fecha,
    });

    return jsonCors(actualizado, { status: 200 });
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    return jsonCors({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE /api/cliente/:id
export async function DELETE(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: "No autorizado" }, { status: 401 });
  }

  const id = getIdFromUrl(req);
  if (!id) return jsonCors({ error: "ID inválido" }, { status: 400 });

  try {
    await eliminarCliente(id);
    return jsonCors(
      { message: "Cliente eliminado correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return jsonCors({ error: "Error interno del servidor" }, { status: 500 });
  }
}
