import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";

import {
  getCompraById,
  updateCompra,
  deleteCompra,
} from "../../../../lib/services/compraService";

function getId(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.pathname.split("/").pop());
  return isNaN(id) ? null : id;
}

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/compra/:id
export async function GET(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  const compra = await getCompraById(id);
  if (!compra) return jsonCors({ message: "Compra no encontrada" }, { status: 404 });

  return jsonCors(compra);
}

// PUT /api/compra/:id
export async function PUT(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const actualizada = await updateCompra(id, body);

  return jsonCors(actualizada);
}

// DELETE /api/compra/:id
export async function DELETE(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const id = getId(req);
  if (!id) return jsonCors({ message: "ID inválido" }, { status: 400 });

  await deleteCompra(id);
  return jsonCors({ message: "Compra eliminada" });
}
