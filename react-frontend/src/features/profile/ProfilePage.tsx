"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { api } from "../../lib/apiClient"
import { useAuthUser } from "../../lib/hooks/useAuthUser"

const profileSchema = z
  .object({
    nombre_completo: z.string().min(3, "Ingresa tu nombre completo"),
    correo: z.string().email("Correo inválido"),
    telefono: z.string().max(20).optional().or(z.literal("")),
    direccion: z.string().max(150).optional().or(z.literal("")),
    password: z.string().min(8, "Debe tener al menos 8 caracteres").optional().or(z.literal("")),
    confirmarPassword: z.string().optional().or(z.literal("")),
  })
  .refine((data) => !data.password || data.password === data.confirmarPassword, {
    path: ["confirmarPassword"],
    message: "Las contraseñas no coinciden",
  })

export type ProfileFormValues = z.infer<typeof profileSchema>

type UsuarioDetalle = {
  id_usuario: number
  nombre_completo: string
  correo: string
  telefono: string | null
  direccion: string | null
  cedula: string | null
  rol: string
}

export default function ProfilePage() {
  const { authUser } = useAuthUser()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null)

  const userId = authUser?.id_usuario

  const profileQuery = useQuery<UsuarioDetalle | null>({
    queryKey: ["usuario", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await api.get<UsuarioDetalle>(`/usuarios/${userId}`)
      return data ?? null
    },
  })

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre_completo: "",
      correo: "",
      telefono: "",
      direccion: "",
      password: "",
      confirmarPassword: "",
    },
  })

  useEffect(() => {
    if (profileQuery.data) {
      form.reset({
        nombre_completo: profileQuery.data.nombre_completo ?? "",
        correo: profileQuery.data.correo ?? "",
        telefono: profileQuery.data.telefono ?? "",
        direccion: profileQuery.data.direccion ?? "",
        password: "",
        confirmarPassword: "",
      })
    }
  }, [profileQuery.data, form])

  const buildPayload = (values: ProfileFormValues) => {
    const payload: Record<string, string | null | undefined> = {
      nombre_completo: values.nombre_completo.trim(),
      correo: values.correo.trim(),
      telefono: values.telefono?.trim() ? values.telefono.trim() : null,
      direccion: values.direccion?.trim() ? values.direccion.trim() : null,
    }

    if (values.password && values.password.trim().length > 0) {
      payload.password = values.password.trim()
    }

    return payload
  }

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error("Usuario no encontrado")
      const payload = buildPayload(values)
      const { data } = await api.put<UsuarioDetalle>(`/usuarios/${userId}`, payload)
      return data
    },
    onSuccess: (updated, values) => {
      queryClient.setQueryData(["usuario", userId], updated)
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id_usuario: updated.id_usuario,
          nombre_completo: updated.nombre_completo,
          correo: updated.correo,
          rol: updated.rol,
        })
      )
      window.dispatchEvent(new Event("auth_user:updated"))
      form.reset({
        ...values,
        password: "",
        confirmarPassword: "",
      })
      setFeedback({ message: "Perfil actualizado correctamente", tone: "success" })
    },
    onError: (error) => {
      const message =
        (typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : null) ?? "No se pudo actualizar el perfil"
      setFeedback({ message, tone: "error" })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    setFeedback(null)
    mutation.mutate(values)
  })

  const disabled = mutation.isPending || profileQuery.isLoading
  const heading = useMemo(() => {
    if (!authUser) return "Perfil"
    return authUser.nombre_completo ?? "Perfil"
  }, [authUser])

  if (!authUser) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Debes iniciar sesión para editar tu perfil.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta</p>
        <h1 className="text-3xl font-semibold text-slate-900">{heading}</h1>
        <p className="text-sm text-slate-500">Actualiza tus datos personales y cambia tu contraseña desde un solo lugar.</p>
      </header>

      {profileQuery.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          No pudimos cargar tu información. Intenta nuevamente.
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombre completo" error={form.formState.errors.nombre_completo?.message}>
            <input
              type="text"
              {...form.register("nombre_completo")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Correo" error={form.formState.errors.correo?.message}>
            <input
              type="email"
              {...form.register("correo")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Teléfono" error={form.formState.errors.telefono?.message}>
            <input
              type="tel"
              {...form.register("telefono")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Dirección" error={form.formState.errors.direccion?.message}>
            <input
              type="text"
              {...form.register("direccion")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Nueva contraseña" description="Déjalo vacío si no deseas cambiarla" error={form.formState.errors.password?.message}>
            <input
              type="password"
              {...form.register("password")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Confirmar contraseña" error={form.formState.errors.confirmarPassword?.message}>
            <input
              type="password"
              {...form.register("confirmarPassword")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              disabled={disabled}
            />
          </FormField>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              feedback.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback.tone === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {feedback.message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}

type FormFieldProps = {
  label: string
  error?: string
  description?: string
  children: ReactNode
}

const FormField = ({ label, error, description, children }: FormFieldProps) => (
  <label className="flex w-full flex-col text-sm font-medium text-slate-700">
    <span className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {description && <span className="mt-1 text-xs text-slate-400">{description}</span>}
    {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
  </label>
)