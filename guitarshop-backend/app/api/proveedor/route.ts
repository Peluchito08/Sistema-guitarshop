import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";

import {
  getAllProveedores,
  createProveedor,
  type ProveedorCreateInput,
} from "../../../lib/services/proveedorService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/proveedores  -> lista todos
export async function GET(request: Request) {
  const validation = verifyToken(request);
  if (!validation.valid) {
    return jsonCors({ error: validation.message }, { status: 401 });
  }

  const proveedores = await getAllProveedores();
  return jsonCors(proveedores);
}

// POST /api/proveedores -> crear
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProveedorCreateInput>;

    // Validaciones mínimas
    if (!body.nombre_proveedor) {
      return jsonCors(
        { message: "El nombre del proveedor es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.telefono) {
      return jsonCors(
        { message: "El teléfono es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.correo) {
      return jsonCors(
        { message: "El correo es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.direccion) {
      return jsonCors(
        { message: "La dirección es obligatoria" },
        { status: 400 }
      );
    }
    if (body.id_estado === undefined || body.id_estado === null) {
      return jsonCors(
        { message: "El id_estado es obligatorio" },
        { status: 400 }
      );
    }

    const nuevoProveedor = await createProveedor(body as ProveedorCreateInput);
    return jsonCors(nuevoProveedor, { status: 201 });
  } catch (error) {
    console.error("Error al crear proveedor:", error);
    return jsonCors({ message: "Error al crear proveedor" }, { status: 500 });
  }
}
