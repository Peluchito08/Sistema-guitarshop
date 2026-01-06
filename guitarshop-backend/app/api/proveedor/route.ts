// guitarshop-backend/app/api/proveedor/route.ts
import { jsonCors, optionsCors } from "../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../lib/auth";
import {
  listarProveedores,
  crearProveedor,
} from "../../../lib/services/proveedorService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/proveedor
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

  try {
    const proveedores = await listarProveedores();
    return jsonCors(proveedores, { status: 200 });
  } catch (error) {
    console.error("Error GET /proveedor:", error);
    return jsonCors(
      { error: "Error al obtener proveedores" },
      { status: 500 }
    );
  }
}

// POST /api/proveedor
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
      { error: "Solo administradores pueden crear proveedores" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const proveedor = await crearProveedor({
      nombre_proveedor: body.nombre_proveedor,
      ruc_cedula: body.ruc_cedula,
      correo: body.correo ?? null,
      telefono: body.telefono ?? null,
      direccion: body.direccion ?? null,
      id_usuario_modifi: auth.userId ?? null,
    });

    return jsonCors(proveedor, { status: 201 });
  } catch (error: unknown) {
    console.error("Error POST /proveedor:", error);

    if (error instanceof Error && error.message === "PROVEEDOR_DUPLICADO") {
      return jsonCors(
        { error: "El RUC/Cédula ya está registrado para otro proveedor" },
        { status: 400 }
      );
    }

    return jsonCors(
      { error: "Error al crear proveedor" },
      { status: 500 }
    );
  }
}
