// lib/services/clienteService.ts
import prisma from "../prisma";

export interface ClienteInput {
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  direccion: string;
  id_estado: number;
  id_usuario_modifi?: number | null;
  fecha?: Date | string;
}

export async function listarClientes() {
  return prisma.cliente.findMany({
    orderBy: { id_cliente: "asc" },
  });
}

export async function obtenerClientePorId(id: number) {
  return prisma.cliente.findUnique({
    where: { id_cliente: id },
  });
}

export async function crearCliente(data: ClienteInput) {
  const ahora = new Date();

  return prisma.cliente.create({
    data: {
      nombre: data.nombre,
      cedula: data.cedula,
      correo: data.correo,
      telefono: data.telefono,
      direccion: data.direccion,
      fecha: data.fecha ?? ahora,
      fecha_creacion: ahora,
      id_estado: data.id_estado,
      id_usuario_modifi: data.id_usuario_modifi ?? null,
    },
  });
}

export async function actualizarCliente(
  id: number,
  data: Partial<ClienteInput>
) {
  return prisma.cliente.update({
    where: { id_cliente: id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.cedula !== undefined && { cedula: data.cedula }),
      ...(data.correo !== undefined && { correo: data.correo }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.direccion !== undefined && { direccion: data.direccion }),
      ...(data.fecha !== undefined && { fecha: data.fecha }),
      ...(data.id_estado !== undefined && { id_estado: data.id_estado }),
      ...(data.id_usuario_modifi !== undefined && {
        id_usuario_modifi: data.id_usuario_modifi,
      }),
    },
  });
}

export async function eliminarCliente(id: number) {
  return prisma.cliente.delete({
    where: { id_cliente: id },
  });
}
