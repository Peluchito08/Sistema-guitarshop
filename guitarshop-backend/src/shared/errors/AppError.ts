export type AppErrorCode = string | number;

export class AppError extends Error {
	status: number;
	code: AppErrorCode;
	details?: unknown;

	constructor(options: {
		message: string;
		status?: number;
		code?: AppErrorCode;
		details?: unknown;
	}) {
		super(options.message);
		this.name = "AppError";
		this.status = options.status ?? 400;
		this.code = options.code ?? "APP_ERROR";
		this.details = options.details;
	}
}

