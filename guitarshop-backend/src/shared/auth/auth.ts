import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en las variables de entorno");
}

export interface AuthResult {
  valid: boolean;
  userId?: number;
  rol?: string;
  message?: string;
}

export function hasAdminRole(auth: AuthResult): boolean {
  return !!auth.rol && auth.rol.toUpperCase() === "ADMIN";
}

// Extrae el token del header Authorization: Bearer xxx
function getTokenFromRequest(req: Request): string | null {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring("Bearer ".length);
  }

  const tokenHeader = req.headers.get("x-access-token");
  if (tokenHeader) return tokenHeader;

  return null;
}

export function verifyToken(req: Request): AuthResult {
  const token = getTokenFromRequest(req);

  if (!token) {
    return {
      valid: false,
      message: "Token no proporcionado",
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & {
      id?: number;
      rol?: string;
    };

    return {
      valid: true,
      userId: decoded.id,
      rol: decoded.rol,
    };
  } catch (err) {
    console.error("Error al verificar token:", err);
    return {
      valid: false,
      message: "Token inválido o expirado",
    };
  }
}
