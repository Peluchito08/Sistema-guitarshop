// guitarshop-backend/app/api/ventas/route.ts
import { jsonCors, optionsCors } from "../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../lib/auth";
import {
  listarVentas,
  crearVenta,
} from "../../../lib/services/facturaService";

export async function OPTIONS() {
  return optionsCors();
}

// GET /api/ventas  -> lista de facturas
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
      { error: "Solo administradores pueden acceder a ventas" },
      { status: 403 }
    );
  }

  try {
    const ventas = await listarVentas();
    return jsonCors(ventas, { status: 200 });
  } catch (error) {
    console.error("Error GET /ventas:", error);
    return jsonCors(
      { error: "Error al obtener ventas" },
      { status: 500 }
    );
  }
}

// POST /api/ventas  -> crear factura
export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.userId) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  if (!hasAdminRole(auth)) {
    return jsonCors(
      { error: "Solo administradores pueden crear ventas" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const venta = await crearVenta({
      id_cliente: body.id_cliente,
      id_usuario: auth.userId,
      forma_pago: body.forma_pago ?? "CONTADO",
      observacion: body.observacion ?? null,
      detalle: body.detalle ?? [],
      creditoConfig: body.creditoConfig,
      id_usuario_modifi: auth.userId,
    });

    return jsonCors(venta, { status: 201 });
  } catch (error: unknown) {
    console.error("Error POST /ventas:", error);

    if (error instanceof Error) {
      if (error.message === "DETALLE_VACIO") {
        return jsonCors(
          { error: "La factura debe tener al menos un producto" },
          { status: 400 }
        );
      }
      if (error.message.startsWith("STOCK_INSUFICIENTE_")) {
        return jsonCors(
          {
            error:
              "No hay stock suficiente para uno de los productos de la venta",
            detalle: error.message,
          },
          { status: 400 }
        );
      }
      if (error.message === "CREDITO_SIN_CONFIG") {
        return jsonCors(
          {
            error:
              "Faltan datos de configuración para generar el crédito (cuotas)",
          },
          { status: 400 }
        );
      }
      if (error.message === "NUMERO_CUOTAS_INVALIDO") {
        return jsonCors(
          { error: "El número de cuotas del crédito es inválido" },
          { status: 400 }
        );
      }
    }

    return jsonCors(
      { error: "Error al crear venta" },
      { status: 500 }
    );
  }
}
