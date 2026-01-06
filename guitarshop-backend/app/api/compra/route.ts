// guitarshop-backend/app/api/compras/route.ts
import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";
import {
  listarCompras,
  crearCompra,
} from "../../../lib/services/compraService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/compras  (lista cabeceras)
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  try {
    const compras = await listarCompras();
    return jsonCors(compras, { status: 200 });
  } catch (error) {
    console.error("Error GET /compras:", error);
    return jsonCors(
      { error: "Error al obtener compras" },
      { status: 500 }
    );
  }
}

// POST /api/compras  (crear compra completa)
export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.userId) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // Esperamos algo así:
    // {
    //   "id_proveedor": 1,
    //   "observacion": "Compra inicial",
    //   "detalle": [
    //     { "id_producto": 1, "cantidad": 5, "costo_unitario": 100 },
    //     { "id_producto": 2, "cantidad": 2, "costo_unitario": 200 }
    //   ]
    // }

    const compra = await crearCompra({
      id_proveedor: body.id_proveedor,
      id_usuario: auth.userId,
      observacion: body.observacion ?? null,
      detalle: body.detalle ?? [],
      id_usuario_modifi: auth.userId,
    });

    return jsonCors(compra, { status: 201 });
  } catch (error: unknown) {
    console.error("Error POST /compras:", error);

    if (error instanceof Error && error.message === "DETALLE_VACIO") {
      return jsonCors(
        { error: "La compra debe tener al menos un producto en el detalle" },
        { status: 400 }
      );
    }

    return jsonCors(
      { error: "Error al crear compra" },
      { status: 500 }
    );
  }
}
