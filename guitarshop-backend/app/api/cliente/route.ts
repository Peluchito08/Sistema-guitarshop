import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";
import {
  listarClientes,
  crearCliente,
} from "../../../lib/services/clienteService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/cliente
export async function GET(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const clientes = await listarClientes();
    return jsonCors(clientes, { status: 200 });
  } catch (error) {
    console.error("Error al listar clientes:", error);
    return jsonCors({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST /api/cliente
export async function POST(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid) {
    return jsonCors({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const nuevo = await crearCliente({
      nombre: body.nombre,
      cedula: body.cedula,
      correo: body.correo,
      telefono: body.telefono,
      direccion: body.direccion,
      id_estado: body.id_estado,
      id_usuario_modifi: body.id_usuario_modifi ?? null,
      fecha: body.fecha,
    });

    return jsonCors(nuevo, { status: 201 });
  } catch (error) {
    console.error("Error al crear cliente:", error);
    return jsonCors({ error: "Error interno del servidor" }, { status: 500 });
  }
}
