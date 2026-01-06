import prisma from "../../../shared/prisma/prismaClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en las variables de entorno");
}

// Para usar al crear / actualizar usuarios
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function loginUsuario(email: string, password: string) {
  // Busca usuario por correo
  const user = await prisma.usuario.findUnique({
    where: { correo: email },
  });

  // Si no existe o está inactivo
  if (!user || user.id_estado !== 1) return null;

  // Compara contraseña enviada con el password_hash de la BD
  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) return null;

  // Payload del token (ojo: la propiedad se llama "id" porque
  // tu verifyToken la lee así)
  const token = jwt.sign(
    {
      id: user.id_usuario,
      correo: user.correo,
      rol: user.rol,
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  // Lo que devolvemos al frontend (sin password_hash)
  return {
    token,
    usuario: {
      id_usuario: user.id_usuario,
      nombre_completo: user.nombre_completo,
      correo: user.correo,
      rol: user.rol,
    },
  };
}
