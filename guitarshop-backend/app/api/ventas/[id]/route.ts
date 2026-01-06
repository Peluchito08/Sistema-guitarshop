// guitarshop-backend/app/api/ventas/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import { z } from "zod";
import { parseOrThrow } from "../../../../src/shared/validation/zod";
import { withErrorHandling } from "../../../../src/shared/http/routeHandler";
import {
  obtenerVentaPorId,
  actualizarVenta,
  anularVenta,
} from "../../../../lib/services/facturaService";

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

// GET /api/ventas/:id
export const GET = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Solo administradores pueden acceder a ventas" }, { status: 403 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const venta = await obtenerVentaPorId(id);
  if (!venta) {
    return jsonCors({ error: "Venta no encontrada" }, { status: 404 });
  }

  return jsonCors(venta, { status: 200 });
});

// PUT /api/ventas/:id (actualiza solo observaciones)
export const PUT = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Solo administradores pueden actualizar ventas" }, { status: 403 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json();
  const schema = z.object({ observacion: z.string().trim().nullable().optional() }).passthrough();
  const dto = parseOrThrow(schema, body);

  const venta = await actualizarVenta(id, {
    observacion: dto.observacion ?? null,
    id_usuario_modifi: auth.userId ?? null,
  });

  return jsonCors(venta, { status: 200 });
});

// DELETE /api/ventas/:id (anular)
export const DELETE = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Solo administradores pueden anular ventas" }, { status: 403 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const venta = await anularVenta(id, auth.userId ?? null);
  return jsonCors(venta, { status: 200 });
});
