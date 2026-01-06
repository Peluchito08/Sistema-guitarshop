// guitarshop-backend/app/api/cuota/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import {
  obtenerCuotaDetallePorId,
  pagarCuota,
} from "../../../../lib/services/cuotaService";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/cuota/:id  -> info de una cuota
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const cuota = await obtenerCuotaDetallePorId(id);
    if (!cuota) {
      return jsonCors(
        { error: "Cuota no encontrada" },
        { status: 404 }
      );
    }

    return jsonCors(cuota, { status: 200 });
  } catch (err) {
    console.error("Error GET /cuota/:id", err);
    return jsonCors(
      { error: "Error al obtener cuota" },
      { status: 500 }
    );
  }
}

// PATCH /api/cuota/:id  -> pagar cuota
export async function PATCH(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.userId) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const montoPago = Number(body.monto_pago);

    if (!body.monto_pago || isNaN(montoPago)) {
      return jsonCors(
        { error: "monto_pago es obligatorio y debe ser numérico" },
        { status: 400 }
      );
    }

    const resultado = await pagarCuota({
      id_cuota: id,
      montoPago,
      id_usuario_modifi: auth.userId,
    });

    return jsonCors(
      {
        message: "Pago registrado correctamente",
        cuota: resultado.cuota,
        credito: resultado.credito,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error PATCH /cuota/:id", error);

    if (error instanceof Error) {
      if (error.message === "CUOTA_NO_ENCONTRADA") {
        return jsonCors(
          { error: "Cuota no encontrada" },
          { status: 404 }
        );
      }
      if (error.message === "CUOTA_YA_PAGADA") {
        return jsonCors(
          { error: "La cuota ya está pagada" },
          { status: 400 }
        );
      }
      if (error.message === "MONTO_INVALIDO") {
        return jsonCors(
          { error: "El monto debe ser mayor a 0" },
          { status: 400 }
        );
      }
      if (error.message === "MONTO_SUPERA_SALDO_CUOTA") {
        return jsonCors(
          { error: "El monto supera el saldo pendiente de la cuota" },
          { status: 400 }
        );
      }
    }

    return jsonCors(
      { error: "Error al registrar el pago de la cuota" },
      { status: 500 }
    );
  }
}
