import type { ZodType } from "zod";
import { AppError } from "../errors/AppError";

/**
 * Parsea un payload usando un schema Zod.
 * Si falla, lanza AppError para que el routeHandler lo devuelva como JSON con CORS.
 */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
	const result = schema.safeParse(data);
	if (result.success) return result.data;

	throw new AppError({
		message: "Datos inválidos",
		status: 400,
		code: "VALIDATION_ERROR",
		details: result.error.flatten(),
	});
}
