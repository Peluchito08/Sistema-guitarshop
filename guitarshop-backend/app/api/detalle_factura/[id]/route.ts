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
		const detalle = await prisma.detalle_factura.findUnique({
			where: { id_detalle_factura: id },
			select: {
				id_detalle_factura: true,
				id_factura: true,
				id_producto: true,
				cantidad: true,
				precio_unitario: true,
				descuento: true,
				subtotal: true,
				id_estado: true,
				factura: {
					select: {
						numero_factura: true,
						fecha_factura: true,
						total: true,
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

		if (!detalle) {
			return jsonCors({ error: "Detalle no encontrado" }, { status: 404 });
		}

		return jsonCors(detalle, { status: 200 });
	} catch (error) {
		console.error("Error GET /detalle_factura/:id", error);
		return jsonCors(
			{ error: "Error al obtener detalle de factura" },
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
				"Operación no soportada: para modificar detalles use /api/ventas para mantener stock/totales.",
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
				"Operación no soportada: para anular ventas use /api/ventas/:id (DELETE) para mantener stock/totales.",
		},
		{ status: 409 }
	);
}
