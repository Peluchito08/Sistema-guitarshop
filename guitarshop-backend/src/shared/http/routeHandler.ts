import { jsonCors } from "./cors/cors";
import { AppError } from "../errors/AppError";
import { Prisma } from "../../../generated/prisma/client";

type ErrorResponseBody = {
	error: string;
	code?: string;
	details?: unknown;
};

function mapLegacyErrorCode(
	message: string
): { status: number; code: string; message: string } | null {
	switch (message) {
		case "PRODUCTO_DUPLICADO":
			return {
				status: 409,
				code: message,
				message: "El código de producto ya está registrado",
			};
		case "PROVEEDOR_REQUERIDO":
			return {
				status: 400,
				code: message,
				message: "Debes seleccionar un proveedor",
			};
		case "CLIENTE_DUPLICADO":
			return {
				status: 400,
				code: message,
				message: "La cédula o correo ya están registrados para otro cliente",
			};
		case "PROVEEDOR_DUPLICADO":
			return {
				status: 400,
				code: message,
				message: "El RUC/Cédula ya está registrado para otro proveedor",
			};
		case "PROVEEDOR_CON_RELACIONES":
			return {
				status: 409,
				code: message,
				message:
					"No se puede eliminar el proveedor porque tiene productos o compras asociadas.",
			};
		case "DETALLE_VACIO":
			return {
				status: 400,
				code: message,
				message: "La factura debe tener al menos un producto",
			};
		case "CREDITO_SIN_CONFIG":
			return {
				status: 400,
				code: message,
				message:
					"Faltan datos de configuración para generar el crédito (cuotas)",
			};
		case "NUMERO_CUOTAS_INVALIDO":
			return {
				status: 400,
				code: message,
				message: "El número de cuotas del crédito es inválido",
			};
		case "PRODUCTO_CON_RELACIONES":
			return {
				status: 409,
				code: message,
				message:
					"No se puede eliminar: el producto tiene relaciones (compras/ventas/kardex)",
			};

		// Ventas/Facturas (anulación/actualización)
		case "VENTA_NO_ENCONTRADA":
			return { status: 404, code: message, message: "Factura no encontrada" };
		case "VENTA_YA_ANULADA":
			return { status: 409, code: message, message: "La factura ya está anulada" };
		case "ESTADO_ANULADO_NO_CONFIGURADO":
			return {
				status: 500,
				code: message,
				message: "No existe el estado ANULADO en la base de datos",
			};

		// Cuotas
		case "CUOTA_NO_ENCONTRADA":
			return { status: 404, code: message, message: "Cuota no encontrada" };
		case "CUOTA_YA_PAGADA":
			return { status: 400, code: message, message: "La cuota ya está pagada" };
		case "MONTO_INVALIDO":
			return { status: 400, code: message, message: "El monto debe ser mayor a 0" };
		case "MONTO_SUPERA_SALDO_CUOTA":
			return {
				status: 400,
				code: message,
				message: "El monto supera el saldo pendiente de la cuota",
			};

		default:
			return null;
	}
}

export function errorToCorsResponse(err: unknown): Response {
	if (err instanceof AppError) {
		return jsonCors(
			{
				error: err.message,
				code: String(err.code),
				details: err.details,
			} satisfies ErrorResponseBody,
			{ status: err.status }
		);
	}

	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			return jsonCors(
				{
					error: "Conflicto por dato duplicado",
					code: "CONFLICT",
					details: err.meta,
				} satisfies ErrorResponseBody,
				{ status: 409 }
			);
		}
	}

	if (err instanceof Error) {
		if (err.message.startsWith("STOCK_INSUFICIENTE_")) {
			return jsonCors(
				{
					error: "No hay stock suficiente para uno de los productos de la venta",
					code: "STOCK_INSUFICIENTE",
					details: err.message,
				} satisfies ErrorResponseBody,
				{ status: 400 }
			);
		}

		if (err.message.startsWith("PRODUCTO_NO_ENCONTRADO_")) {
			return jsonCors(
				{
					error: "Producto no encontrado",
					code: "PRODUCTO_NO_ENCONTRADO",
					details: err.message,
				} satisfies ErrorResponseBody,
				{ status: 404 }
			);
		}

		const legacy = mapLegacyErrorCode(err.message);
		if (legacy) {
			return jsonCors(
				{
					error: legacy.message,
					code: legacy.code,
				} satisfies ErrorResponseBody,
				{ status: legacy.status }
			);
		}
	}

	console.error("Unhandled error:", err);
	return jsonCors(
		{
			error: "Error interno",
			code: "INTERNAL_ERROR",
		} satisfies ErrorResponseBody,
		{ status: 500 }
	);
}

export function withErrorHandling<TCtx = unknown>(
	handler: (req: Request, ctx: TCtx) => Promise<Response> | Response
) {
	return async (req: Request, ctx: TCtx): Promise<Response> => {
		try {
			return await handler(req, ctx);
		} catch (err) {
			return errorToCorsResponse(err);
		}
	};
}

