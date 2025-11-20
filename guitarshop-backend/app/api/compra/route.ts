import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";

import {
  getAllCompras,
  createCompra,
  type CompraCreateInput,
} from "../../../lib/services/compraService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/compra
export async function GET(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const compras = await getAllCompras();
  return jsonCors(compras);
}

// POST /api/compra
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompraCreateInput;

    if (!body.id_proveedor || !body.id_usuario || !body.total_compra || !body.id_estado) {
      return jsonCors({ message: "Datos incompletos para crear la compra" }, { status: 400 });
    }

    const nueva = await createCompra(body);
    return jsonCors(nueva, { status: 201 });

  } catch (err) {
    console.error("Error POST /compra:", err);
    return jsonCors({ message: "Error al crear compra" }, { status: 500 });
  }
}
