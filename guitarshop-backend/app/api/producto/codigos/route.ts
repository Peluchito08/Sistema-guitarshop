import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import { listarCodigosProductoActivos } from "../../../../lib/services/productoService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/producto/codigos
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  try {
    const codigos = await listarCodigosProductoActivos();
    return jsonCors(codigos, { status: 200 });
  } catch (error) {
    console.error("Error GET /producto/codigos:", error);
    return jsonCors({ error: "Error al obtener códigos" }, { status: 500 });
  }
}
