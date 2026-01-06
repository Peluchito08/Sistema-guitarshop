import { jsonCors, optionsCors } from "../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";

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

	const url = new URL(req.url);
	const parts = url.pathname.split("/");
	const idString = parts[parts.length - 1];
	const id = Number(idString);
	if (!id || Number.isNaN(id)) {
		return jsonCors({ error: "ID inválido" }, { status: 400 });
	}

	try {
		const movimiento = await prisma.kardex.findUnique({
			where: { id_kardex: id },
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
		});

		if (!movimiento) {
			return jsonCors({ error: "Movimiento no encontrado" }, { status: 404 });
		}

		return jsonCors(movimiento, { status: 200 });
	} catch (error) {
		console.error("Error GET /kardex/:id", error);
		return jsonCors(
			{ error: "Error al obtener movimiento de kardex" },
			{ status: 500 }
		);
	}
}

