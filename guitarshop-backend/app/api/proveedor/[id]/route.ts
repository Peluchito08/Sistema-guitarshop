import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";

import {
  getProveedorById,
  updateProveedor,
  deleteProveedor,
  type ProveedorCreateInput,
} from "../../../../lib/services/proveedorService";

function getId(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.pathname.split("/").pop());
  return Number.isNaN(id) ? null : id;
}

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/proveedores/:id
export async function GET(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid)
    return jsonCors({ error: validation.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  const prov = await getProveedorById(id);
  if (!prov) return jsonCors({ message: "Proveedor no encontrado" }, { status: 404 });

  return jsonCors(prov);
}

// PUT /api/proveedores/:id
export async function PUT(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid)
    return jsonCors({ error: validation.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  const body = (await req.json()) as Partial<ProveedorCreateInput>;

  const actualizado = await updateProveedor(id, body);
  return jsonCors(actualizado);
}

// DELETE /api/proveedores/:id
export async function DELETE(req: Request) {
  const validation = verifyToken(req);
  if (!validation.valid)
    return jsonCors({ error: validation.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  const eliminado = await deleteProveedor(id);
  return jsonCors(eliminado);
}
