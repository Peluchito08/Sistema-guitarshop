import { jsonCors, optionsCors } from "../../../lib/cors"; // Helpers que encapsulan respuestas HTTP con CORS habilitado.
import { loginUsuario } from "../../../lib/services/authService"; // Servicio centralizado que valida credenciales contra la base de datos.

type LoginBody = {
  email: string;
  password: string;
}; // Esquema esperado en el cuerpo JSON para iniciar sesión.

// Handler para el preflight CORS (OPTIONS)
export async function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  try {
    const body: LoginBody = await request.json(); // Parseamos el JSON recibido en la petición.
    const { email, password } = body;

    if (!email || !password) {
      return jsonCors(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Delegamos la validación al servicio de autenticación que maneja hashing/tokens
    const result = await loginUsuario(email, password);

    // Si result es null → credenciales inválidas
    if (!result) {
      return jsonCors(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    return jsonCors(
      {
        message: "Login correcto",
        token: result.token,
        usuario: result.usuario,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en /api/login:", error); // Logueamos para diagnóstico sin exponer detalles sensibles al cliente.
    return jsonCors(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
