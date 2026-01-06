// guitarshop-backend/app/api/clientes/route.ts
import { jsonCors, optionsCors } from "../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../lib/auth";
import {
  listarClientes,
  crearCliente,
} from "../../../lib/services/clienteService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/clientes
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

  try {
    const clientes = await listarClientes();
    return jsonCors(clientes, { status: 200 });
  } catch (error) {
    console.error("Error GET /clientes:", error);
    return jsonCors(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

// POST /api/clientes
export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  if (!hasAdminRole(auth)) {
    return jsonCors(
      { error: "Solo administradores pueden crear clientes" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const cliente = await crearCliente({
      nombres: body.nombres,
      apellidos: body.apellidos,
      cedula: body.cedula,
      correo: body.correo ?? null,
      telefono: body.telefono ?? null,
      direccion: body.direccion ?? null,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(cliente, { status: 201 });
  } catch (error: unknown) {
    console.error("Error POST /clientes:", error);

    if (error instanceof Error && error.message === "CLIENTE_DUPLICADO") {
      return jsonCors(
        { error: "La cédula o correo ya están registrados para otro cliente" },
        { status: 400 }
      );
    }

    return jsonCors(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
}
