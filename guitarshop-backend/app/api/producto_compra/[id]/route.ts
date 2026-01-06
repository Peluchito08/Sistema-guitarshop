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
		const item = await prisma.producto_compra.findUnique({
			where: { id_producto_compra: id },
			select: {
				id_producto_compra: true,
				id_compra: true,
				id_producto: true,
				cantidad_compra: true,
				costo_unitario: true,
				subtotal: true,
				id_estado: true,
				compra: {
					select: {
						fecha_compra: true,
						total: true,
						proveedor: {
							select: { nombre_proveedor: true },
						},
					},
				},
				producto: {
					select: {
						codigo_producto: true,
						nombre_producto: true,
					},
				},
			},
		});

		if (!item) {
			return jsonCors({ error: "Detalle no encontrado" }, { status: 404 });
		}

		return jsonCors(item, { status: 200 });
	} catch (error) {
		console.error("Error GET /producto_compra/:id", error);
		return jsonCors(
			{ error: "Error al obtener detalle de compra" },
			{ status: 500 }
		);
	}
}

export async function PUT(req: Request) {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	return jsonCors(
		{
			error:
				"Operación no soportada: para modificar compras use /api/compra para mantener stock/kardex/totales.",
		},
		{ status: 409 }
	);
}

export async function DELETE(req: Request) {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	return jsonCors(
		{
			error:
				"Operación no soportada: para anular compras se requiere una operación transaccional (stock/kardex).",
		},
		{ status: 409 }
	);
}

