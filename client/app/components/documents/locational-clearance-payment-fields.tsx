import type { Document } from "~/api/DocumentService"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

export interface LocationalClearancePaymentValues {
    orNumber: string
    amountPaid: string
    datePaid: string
    dateRequirementsComplied: string
}

export const emptyLocationalClearancePaymentValues = (): LocationalClearancePaymentValues => ({
    orNumber: "",
    amountPaid: "",
    datePaid: "",
    dateRequirementsComplied: "",
})

function toDateInputValue(value: string | null | undefined): string {
    if (!value) {
        return ""
    }

    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? ""
}

export function paymentValuesFromDocument(
    document: Document | null | undefined,
): LocationalClearancePaymentValues {
    if (!document) {
        return emptyLocationalClearancePaymentValues()
    }

    return {
        orNumber: document.or_number?.trim() ?? "",
        amountPaid:
            document.amount_paid === null || document.amount_paid === undefined
                ? ""
                : String(document.amount_paid),
        datePaid: toDateInputValue(document.date_paid),
        dateRequirementsComplied: toDateInputValue(document.date_requirements_complied),
    }
}

export function hasLocationalClearancePaymentDetails(
    document: Document | null | undefined,
): boolean {
    const values = paymentValuesFromDocument(document)

    return values.orNumber !== "" && values.amountPaid !== "" && values.datePaid !== ""
}

interface LocationalClearancePaymentFieldsProps {
    values: LocationalClearancePaymentValues
    onChange: (values: LocationalClearancePaymentValues) => void
    disabled?: boolean
}

export function LocationalClearancePaymentFields({
    values,
    onChange,
    disabled = false,
}: LocationalClearancePaymentFieldsProps) {
    const update = <K extends keyof LocationalClearancePaymentValues>(
        key: K,
        value: LocationalClearancePaymentValues[K],
    ) => {
        onChange({ ...values, [key]: value })
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="lc-or-number">OR No.</Label>
                <Input
                    id="lc-or-number"
                    disabled={disabled}
                    value={values.orNumber}
                    onChange={(event) => update("orNumber", event.target.value)}
                    placeholder="Official receipt number"
                    autoComplete="off"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="lc-amount-paid">Amount Paid</Label>
                <Input
                    id="lc-amount-paid"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    value={values.amountPaid}
                    onChange={(event) => update("amountPaid", event.target.value)}
                    placeholder="Enter amount paid"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="lc-date-paid">Date Paid</Label>
                <Input
                    id="lc-date-paid"
                    type="date"
                    disabled={disabled}
                    value={values.datePaid}
                    onChange={(event) => update("datePaid", event.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="lc-requirements-complied">
                    Date Complete Requirements Complied
                </Label>
                <Input
                    id="lc-requirements-complied"
                    type="date"
                    disabled={disabled}
                    value={values.dateRequirementsComplied}
                    onChange={(event) =>
                        update("dateRequirementsComplied", event.target.value)
                    }
                />
            </div>
        </div>
    )
}
