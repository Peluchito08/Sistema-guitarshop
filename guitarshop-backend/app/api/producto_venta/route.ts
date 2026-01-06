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
		const items = await prisma.detalle_factura.findMany({
			select: {
				id_detalle_factura: true,
				id_factura: true,
				id_producto: true,
				cantidad: true,
				precio_unitario: true,
				descuento: true,
				subtotal: true,
				factura: {
					select: {
						numero_factura: true,
						fecha_factura: true,
						cliente: {
							select: { nombres: true, apellidos: true, cedula: true },
						},
					},
				},
				producto: {
					select: { codigo_producto: true, nombre_producto: true },
				},
			},
			orderBy: { id_detalle_factura: "desc" },
		});

		return jsonCors(items, { status: 200 });
	} catch (error) {
		console.error("Error GET /producto_venta:", error);
		return jsonCors(
			{ error: "Error al obtener detalle de ventas" },
			{ status: 500 }
		);
	}
}

export async function POST(req: Request) {
	const guard = requireAdmin(req);
	if (!guard.ok) return guard.response;
	return jsonCors(
		{
			error:
				"Operación no soportada: para registrar ventas use /api/ventas para mantener stock/kardex/totales.",
		},
		{ status: 409 }
	);
}

