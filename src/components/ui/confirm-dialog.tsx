import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { AlertTriangle } from "lucide-react"

import { cn } from "#lib/utils"

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: "danger" | "default"
}) {
  const accent =
    tone === "danger"
      ? "border-rose-400/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
      : "border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
  const iconColor = tone === "danger" ? "text-rose-300" : "text-amber-300"

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
            "data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm"
          )}
        />
        <AlertDialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-sm border border-white/10 bg-popover p-5 text-popover-foreground shadow-2xl shadow-black/50",
            "transition duration-150 data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 shrink-0", iconColor)}>
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex-1">
              <AlertDialogPrimitive.Title className="font-heading text-[15px] font-medium tracking-tight">
                {title}
              </AlertDialogPrimitive.Title>
              {description && (
                <AlertDialogPrimitive.Description className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </AlertDialogPrimitive.Description>
              )}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Close
              className="h-8 rounded-sm border border-white/8 px-3 font-mono text-[11px] tracking-wider text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
            >
              {cancelLabel}
            </AlertDialogPrimitive.Close>
            <AlertDialogPrimitive.Close
              onClick={onConfirm}
              className={cn(
                "h-8 rounded-sm border px-3 font-mono text-[11px] tracking-wider transition-colors",
                accent
              )}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Close>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { ConfirmDialog }
