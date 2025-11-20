import { jsonCors, optionsCors } from "../../../lib/cors";
import { verifyToken } from "../../../lib/auth";
import {
  getAllProductoCompra,
  createProductoCompra,
} from "../../../lib/services/productoCompraService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/producto-compra?id_compra=1  (opcional filtro)
export async function GET(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  const url = new URL(req.url);
  const idCompraParam = url.searchParams.get("id_compra");
  const id_compra = idCompraParam ? Number(idCompraParam) : undefined;

  const data = await getAllProductoCompra(id_compra);
  return jsonCors(data);
}

// POST /api/producto-compra
export async function POST(req: Request) {
  const v = verifyToken(req);
  if (!v.valid) return jsonCors({ error: v.message }, { status: 401 });

  try {
    const body = await req.json();

    const detalle = await createProductoCompra({
      id_compra: Number(body.id_compra),
      id_producto: Number(body.id_producto),
      cantidad_compra: Number(body.cantidad_compra),
      costo_unitario: body.costo_unitario,
      subtotal: body.subtotal, // opcional, si no viene se calcula
    });

    return jsonCors(detalle, { status: 201 });
  } catch (err: any) {
    console.error("Error POST /producto-compra", err);
    return jsonCors(
      { message: "Error al crear producto_compra", detalle: String(err) },
      { status: 500 }
    );
  }
}
