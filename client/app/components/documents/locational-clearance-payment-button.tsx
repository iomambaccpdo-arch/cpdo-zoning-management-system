import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Receipt } from "lucide-react"
import { DocumentService, type Document } from "~/api/DocumentService"
import { LocationalClearancePaymentSection } from "~/components/documents/locational-clearance-payment-section"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { canManageLocationalClearancePayment } from "~/lib/permissions"
import { useAuthStore } from "~/store/auth"

interface LocationalClearancePaymentButtonProps {
    document: Document
    size?: "sm" | "default"
    variant?: "default" | "ghost" | "outline"
    className?: string
    showLabel?: boolean
    iconOnly?: boolean
    title?: string
}

export function LocationalClearancePaymentButton({
    document,
    size = "sm",
    variant = "default",
    className = "bg-indigo-700 hover:bg-indigo-800 text-white",
    showLabel = true,
    iconOnly = false,
    title = "OR / Payment Details",
}: LocationalClearancePaymentButtonProps) {
    const { user } = useAuthStore()
    const [open, setOpen] = React.useState(false)
    const canManage = canManageLocationalClearancePayment(user, document.status)

    const { data: latestDocument } = useQuery({
        queryKey: ["document", document.id],
        queryFn: () => DocumentService.getDocument(document.id),
        enabled: open,
    })

    if (!canManage) {
        return null
    }

    const paymentDocument = latestDocument ?? document

    return (
        <>
            <Button
                size={size}
                variant={variant}
                className={className}
                title={title}
                onClick={() => setOpen(true)}
            >
                <Receipt className={showLabel && !iconOnly ? "h-4 w-4 mr-1" : "h-4 w-4"} />
                {showLabel && !iconOnly && "OR / Payment Details"}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Locational Clearance payment details</DialogTitle>
                        <DialogDescription>
                            {paymentDocument.zoning_application_no} — {paymentDocument.document_title}
                        </DialogDescription>
                    </DialogHeader>
                    <LocationalClearancePaymentSection document={paymentDocument} />
                </DialogContent>
            </Dialog>
        </>
    )
}
