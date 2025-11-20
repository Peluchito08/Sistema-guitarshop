import prisma from "../prisma";
import { Prisma } from "@prisma/client";

export type CompraCreateInput = {
  id_proveedor: number;
  id_usuario: number;
  fecha: Date | string;
  total_compra: number;
  id_estado: number;
  id_usuario_modifi?: number | null;
};

export async function getAllCompras() {
  return prisma.compra.findMany({
    include: {
      proveedor: true,
      usuario: true,
      producto_compra: true,
    },
  });
}

export async function getCompraById(id: number) {
  return prisma.compra.findUnique({
    where: { id_compra: id },
    include: {
      proveedor: true,
      usuario: true,
      producto_compra: true,
    },
  });
}

export async function createCompra(data: CompraCreateInput) {
  return prisma.compra.create({
    data: {
      id_proveedor: data.id_proveedor,
      id_usuario: data.id_usuario,
      fecha: new Date(data.fecha),
      total_compra: data.total_compra,
      fecha_creacion: new Date(),
      id_estado: data.id_estado,
      id_usuario_modifi: data.id_usuario_modifi ?? null,
    },
  });
}

export async function updateCompra(id: number, data: Partial<CompraCreateInput>) {
  return prisma.compra.update({
    where: { id_compra: id },
    data,
  });
}

export async function deleteCompra(id: number) {
  return prisma.compra.delete({
    where: { id_compra: id },
  });
}
