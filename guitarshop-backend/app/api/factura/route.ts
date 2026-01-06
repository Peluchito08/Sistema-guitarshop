import { jsonCors, optionsCors } from "../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../lib/auth";
import { z } from "zod";
import { parseOrThrow } from "../../../src/shared/validation/zod";
import { withErrorHandling } from "../../../src/shared/http/routeHandler";
import { crearVenta, listarVentas } from "../../../lib/services/facturaService";

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

export const GET = withErrorHandling(async (req: Request) => {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;

	const facturas = await listarVentas();
	return jsonCors(facturas, { status: 200 });
});

export const POST = withErrorHandling(async (req: Request) => {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	const auth = guard.auth;
	if (!auth.userId) {
		return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
	}

	const body = await req.json();
	const detalleSchema = z.object({
		id_producto: z.number().int().positive(),
		cantidad: z.number().int().positive(),
		precio_unitario: z.number().positive(),
		descuento: z.number().nonnegative().optional(),
	});

	const creditoConfigSchema = z
		.object({
			numero_cuotas: z.number().int().positive(),
			fecha_primer_vencimiento: z.string().min(1),
			dias_entre_cuotas: z.number().int().positive().optional(),
		})
		.passthrough();

	const schema = z
		.object({
			id_cliente: z.number().int().positive(),
			forma_pago: z.enum(["CONTADO", "CREDITO"]).optional(),
			observacion: z.string().trim().nullable().optional(),
			detalle: z.array(detalleSchema).min(1),
			creditoConfig: creditoConfigSchema.optional(),
		})
		.passthrough();

	const dto = parseOrThrow(schema, body);

	const factura = await crearVenta({
		id_cliente: dto.id_cliente,
		id_usuario: auth.userId,
		forma_pago: dto.forma_pago ?? "CONTADO",
		observacion: dto.observacion ?? null,
		detalle: dto.detalle,
		creditoConfig: dto.creditoConfig,
		id_usuario_modifi: auth.userId,
	});

	return jsonCors(factura, { status: 201 });
});

