import { jsonCors, optionsCors } from "../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../lib/auth";
import prisma from "../../../lib/prisma";

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

	return { ok: true as const };
}

export async function GET(req: Request) {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;

	try {
		const movimientos = await prisma.kardex.findMany({
			select: {
				id_kardex: true,
				id_producto: true,
				fecha_movimiento: true,
				tipo_movimiento: true,
				origen: true,
				id_referencia: true,
				cantidad: true,
				costo_unitario: true,
				comentario: true,
				id_estado: true,
				producto: {
					select: {
						codigo_producto: true,
						nombre_producto: true,
					},
				},
			},
			orderBy: { fecha_movimiento: "desc" },
		});

		return jsonCors(movimientos, { status: 200 });
	} catch (error) {
		console.error("Error GET /kardex:", error);
		return jsonCors(
			{ error: "Error al obtener movimientos de kardex" },
			{ status: 500 }
		);
	}
}

