import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { DocumentService, type Document } from "~/api/DocumentService"
import { Button } from "~/components/ui/button"
import {
    LocationalClearancePaymentFields,
    paymentValuesFromDocument,
    type LocationalClearancePaymentValues,
} from "~/components/documents/locational-clearance-payment-fields"

interface LocationalClearancePaymentSectionProps {
    document: Document
    disabled?: boolean
}

export function LocationalClearancePaymentSection({
    document,
    disabled = false,
}: LocationalClearancePaymentSectionProps) {
    const queryClient = useQueryClient()
    const [values, setValues] = React.useState<LocationalClearancePaymentValues>(
        paymentValuesFromDocument(document),
    )

    React.useEffect(() => {
        setValues(paymentValuesFromDocument(document))
    }, [document])

    const saveMutation = useMutation({
        mutationFn: () => DocumentService.updateLocationalClearancePayment(document.id, values),
        onSuccess: () => {
            toast.success("Locational Clearance payment details saved")
            queryClient.invalidateQueries({ queryKey: ["document", document.id] })
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            queryClient.invalidateQueries({ queryKey: ["attachments"] })
            queryClient.invalidateQueries({ queryKey: ["document-attachments", document.id] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to save payment details")
        },
    })

    const isDisabled = disabled || saveMutation.isPending

    return (
        <section className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
                    Locational Clearance Payment
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                    Enter OR No., amount paid, date paid, and the date complete requirements were
                    complied. These are managed by the Zoning Officer and print on the Locational
                    Clearance. Leave a field blank if it has not been recorded yet.
                </p>
            </div>
            <LocationalClearancePaymentFields
                values={values}
                onChange={setValues}
                disabled={isDisabled}
            />
            <Button
                type="button"
                size="sm"
                className="bg-indigo-700 hover:bg-indigo-800 text-white"
                onClick={() => saveMutation.mutate()}
                disabled={isDisabled}
            >
                {saveMutation.isPending ? "Saving…" : "Save payment details"}
            </Button>
        </section>
    )
}
