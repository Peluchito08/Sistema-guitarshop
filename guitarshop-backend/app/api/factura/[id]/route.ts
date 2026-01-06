import { jsonCors, optionsCors } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import { z } from "zod";
import { parseOrThrow } from "../../../../src/shared/validation/zod";
import { withErrorHandling } from "../../../../src/shared/http/routeHandler";
import {
	actualizarVenta,
	anularVenta,
	obtenerVentaPorId,
} from "../../../../lib/services/facturaService";

export async function OPTIONS() {
	return optionsCors();
}

function requireAdmin(req: Request) {
	const auth = verifyToken(req);
	if (!auth.valid) {
		return {
			ok: false as const,
			response: jsonCors(
				{ error: auth.message ?? "Token inválido" },
				{ status: 401 }
			),
		};
	}

	if (!hasAdminRole(auth)) {
		return {
			ok: false as const,
			response: jsonCors(
				{ error: "Solo administradores pueden acceder a este recurso" },
				{ status: 403 }
			),
		};
	}

	return { ok: true as const, auth };
}

function getIdFromUrl(req: Request): number | null {
	const url = new URL(req.url);
	const parts = url.pathname.split("/");
	const idString = parts[parts.length - 1];
	const id = Number(idString);
	if (!id || Number.isNaN(id)) return null;
	return id;
}

export const GET = withErrorHandling(async (req: Request) => {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;

	const id = getIdFromUrl(req);
	if (!id) {
		return jsonCors({ error: "ID inválido" }, { status: 400 });
	}

	const factura = await obtenerVentaPorId(id);
	if (!factura) {
		return jsonCors({ error: "Factura no encontrada" }, { status: 404 });
	}

	return jsonCors(factura, { status: 200 });
});

export const PUT = withErrorHandling(async (req: Request) => {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	const auth = guard.auth;

	const id = getIdFromUrl(req);
	if (!id) {
		return jsonCors({ error: "ID inválido" }, { status: 400 });
	}

	const body = await req.json();
	const schema = z
		.object({
			observacion: z.string().trim().nullable().optional(),
		})
		.passthrough();
	const dto = parseOrThrow(schema, body);

	const factura = await actualizarVenta(id, {
		observacion: dto.observacion ?? null,
		id_usuario_modifi: auth.userId ?? null,
	});

	return jsonCors(factura, { status: 200 });
});

export const DELETE = withErrorHandling(async (req: Request) => {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	const auth = guard.auth;

	const id = getIdFromUrl(req);
	if (!id) {
		return jsonCors({ error: "ID inválido" }, { status: 400 });
	}

	const factura = await anularVenta(id, auth.userId ?? null);
	return jsonCors(factura, { status: 200 });
});

