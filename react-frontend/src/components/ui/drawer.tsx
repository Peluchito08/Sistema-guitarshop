import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerPortal = DialogPrimitive.Portal
const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			"fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className
		)}
		{...props}
	/>
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
	hideCloseButton?: boolean
	disableOutsideClose?: boolean
}

const DrawerContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	DrawerContentProps
>(({ className, children, hideCloseButton, disableOutsideClose, onInteractOutside, onEscapeKeyDown, ...props }, ref) => (
	<DrawerPortal>
		<DrawerOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				"fixed right-0 top-0 z-50 flex h-dvh w-full max-w-xl flex-col border-l bg-white shadow-2xl outline-none",
				"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
				className
			)}
			onInteractOutside={(event) => {
				if (disableOutsideClose) {
					event.preventDefault()
					return
				}
				onInteractOutside?.(event)
			}}
			onEscapeKeyDown={(event) => {
				if (disableOutsideClose) {
					event.preventDefault()
					return
				}
				onEscapeKeyDown?.(event)
			}}
			{...props}
		>
			{children}
			{!hideCloseButton && (
				<DialogPrimitive.Close
					className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
					aria-label="Cerrar"
				>
					<X className="h-4 w-4" />
				</DialogPrimitive.Close>
			)}
		</DialogPrimitive.Content>
	</DrawerPortal>
))
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("border-b px-6 py-5", className)} {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerTitle = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-slate-900", className)} {...props} />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export {
	Drawer,
	DrawerTrigger,
	DrawerPortal,
	DrawerOverlay,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerDescription,
}
