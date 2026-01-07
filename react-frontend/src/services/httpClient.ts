export type HttpErrorPayload = {
	error?: string
	message?: string
	status?: number
}

export class HttpError extends Error {
	status?: number
	payload?: unknown

	constructor(message: string, opts?: { status?: number; payload?: unknown }) {
		super(message)
		this.name = "HttpError"
		this.status = opts?.status
		this.payload = opts?.payload
	}
}

type RequestOptions = {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
	body?: unknown
	signal?: AbortSignal
	headers?: Record<string, string>
}

const baseUrl = import.meta.env.VITE_API_BASE_URL

async function readJsonSafely(response: Response): Promise<any> {
	const text = await response.text()
	if (!text) return null
	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const token = localStorage.getItem("auth_token")
	const headers: Record<string, string> = {
		Accept: "application/json",
		...(options.headers ?? {}),
	}

	let body: BodyInit | undefined
	if (options.body !== undefined) {
		headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
		body = JSON.stringify(options.body)
	}

	if (token) {
		headers.Authorization = `Bearer ${token}`
	}

	const response = await fetch(`${baseUrl}${path}`, {
		method: options.method ?? "GET",
		headers,
		body,
		signal: options.signal,
	})

	if (response.status === 401) {
		localStorage.removeItem("auth_token")
		window.location.href = "/login"
		throw new HttpError("No autorizado", { status: 401 })
	}

	const payload = await readJsonSafely(response)

	if (!response.ok) {
		const msg =
			(payload && typeof payload === "object" && (payload.error || payload.message))
				? String(payload.error ?? payload.message)
				: `Error HTTP ${response.status}`
		throw new HttpError(msg, { status: response.status, payload })
	}

	return payload as T
}
