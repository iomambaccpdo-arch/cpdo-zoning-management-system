import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Eye, FileBadge, Files, Printer } from "lucide-react"
import { toast } from "sonner"
import { DocumentService } from "~/api/DocumentService"
import type { Document, LocationalClearanceData } from "~/api/DocumentService"
import {
    LocationalClearancePaymentFields,
    hasLocationalClearancePaymentDetails,
    paymentValuesFromDocument,
    type LocationalClearancePaymentValues,
} from "~/components/documents/locational-clearance-payment-fields"
import {
    printBothLocationalClearanceCopies,
    printLocationalClearanceCopy,
    viewLocationalClearance,
} from "~/components/documents/locational-clearance-print"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import {
    checkLocationalClearanceEligibility,
    hasGeneratedLocationalClearance,
} from "~/lib/locational-clearance-utils"
import { canGenerateLocationalClearance } from "~/lib/permissions"
import { useAuthStore } from "~/store/auth"

interface GenerateLocationalClearanceButtonProps {
    document: Document
    size?: "sm" | "default"
    variant?: "default" | "ghost" | "outline"
    className?: string
    showLabel?: boolean
    iconOnly?: boolean
    title?: string
}

export function GenerateLocationalClearanceButton({
    document,
    size = "sm",
    variant = "default",
    className = "bg-indigo-600 hover:bg-indigo-700 text-white",
    showLabel = true,
    iconOnly = false,
    title,
}: GenerateLocationalClearanceButtonProps) {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const canGenerate = canGenerateLocationalClearance(user)
    const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
    const [actionsOpen, setActionsOpen] = React.useState(false)
    const [clearanceData, setClearanceData] = React.useState<LocationalClearanceData | null>(null)
    const [generatedAt, setGeneratedAt] = React.useState(document.locational_clearance_generated_at)
    const [paymentValues, setPaymentValues] = React.useState<LocationalClearancePaymentValues>(
        paymentValuesFromDocument(document),
    )

    const hasFullContext =
        document.status === "approved" &&
        document.inspection_report !== undefined

    const eligibility = hasFullContext
        ? checkLocationalClearanceEligibility(document)
        : null

    const alreadyGenerated = hasGeneratedLocationalClearance({
        ...document,
        locational_clearance_generated_at: generatedAt,
    })

    React.useEffect(() => {
        setGeneratedAt(document.locational_clearance_generated_at)
    }, [document.locational_clearance_generated_at])

    React.useEffect(() => {
        if (paymentDialogOpen) {
            setPaymentValues(paymentValuesFromDocument(document))
        }
    }, [paymentDialogOpen, document])

    const paymentAlreadyRecorded = hasLocationalClearancePaymentDetails(document)
    const buttonTitle = title
        ?? (alreadyGenerated ? "View / Print Locational Clearance" : "Generate Locational Clearance")
    const buttonLabel = alreadyGenerated ? "View / Print" : "Generate Locational Clearance"

    const openActions = (data: LocationalClearanceData) => {
        setClearanceData(data)
        setActionsOpen(true)
    }

    const generateMutation = useMutation({
        mutationFn: async (savePayment: boolean) => {
            if (savePayment) {
                await DocumentService.updateLocationalClearancePayment(document.id, paymentValues)
            }
            return DocumentService.generateLocationalClearance(document.id)
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ["document", document.id] })
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            setPaymentDialogOpen(false)
            setGeneratedAt(response.generatedAt ?? response.document?.locational_clearance_generated_at ?? new Date().toISOString())
            openActions(response.data)
            toast.success("Locational Clearance generated.")
        },
        onError: (error: any) => {
            const reasons = error?.response?.data?.reasons as string[] | undefined
            if (reasons?.length) {
                toast.error(reasons.join(" "))
                return
            }
            toast.error(error?.response?.data?.message || "Failed to generate Locational Clearance")
        },
    })

    const loadMutation = useMutation({
        mutationFn: () => DocumentService.getLocationalClearance(document.id),
        onSuccess: (response) => {
            openActions(response.data)
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to load Locational Clearance")
        },
    })

    if (!canGenerate || document.status !== "approved") {
        return null
    }

    const isBusy = generateMutation.isPending || loadMutation.isPending
    const isDisabled = alreadyGenerated
        ? isBusy
        : (eligibility !== null && !eligibility.eligible) || isBusy

    const handleClick = () => {
        if (alreadyGenerated) {
            loadMutation.mutate()
            return
        }

        if (paymentAlreadyRecorded) {
            generateMutation.mutate(false)
            return
        }

        setPaymentDialogOpen(true)
    }

    const button = (
        <Button
            size={size}
            variant={variant}
            className={className}
            disabled={isDisabled}
            title={buttonTitle}
            onClick={handleClick}
        >
            <FileBadge className={showLabel && !iconOnly ? "h-4 w-4 mr-1" : "h-4 w-4"} />
            {showLabel && !iconOnly && buttonLabel}
        </Button>
    )

    const showEligibilityTooltip = !alreadyGenerated && eligibility && !eligibility.eligible

    return (
        <>
            {!showEligibilityTooltip ? (
                button
            ) : (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex">{button}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium mb-1">Not yet available</p>
                            <ul className="list-disc pl-4 text-xs space-y-0.5">
                                {eligibility.reasons.map((reason) => (
                                    <li key={reason}>{reason}</li>
                                ))}
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Locational Clearance payment details</DialogTitle>
                        <DialogDescription>
                            Enter OR No., amount paid, date paid, and the date complete requirements
                            were complied. These are entered by the Zoning Officer and print on the
                            Locational Clearance. Leave a field blank if it has not been recorded yet.
                        </DialogDescription>
                    </DialogHeader>
                    <LocationalClearancePaymentFields
                        values={paymentValues}
                        onChange={setPaymentValues}
                        disabled={generateMutation.isPending}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPaymentDialogOpen(false)}
                            disabled={generateMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => generateMutation.mutate(true)}
                            disabled={generateMutation.isPending}
                        >
                            {generateMutation.isPending ? "Generating…" : "Save and generate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Locational Clearance</DialogTitle>
                        <DialogDescription>
                            One Locational Clearance record. Both copies use the same LC number,
                            application details, and payment information.
                        </DialogDescription>
                    </DialogHeader>
                    {clearanceData && (
                        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                            <p>
                                <span className="font-medium text-slate-600">Application No.:</span>{" "}
                                {clearanceData.applicationNumber}
                            </p>
                            <p>
                                <span className="font-medium text-slate-600">Decision No.:</span>{" "}
                                {clearanceData.decisionNumber.startsWith("LC-")
                                    ? clearanceData.decisionNumber
                                    : `LC-${clearanceData.decisionNumber}`}
                            </p>
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!clearanceData}
                            onClick={() => clearanceData && viewLocationalClearance(clearanceData)}
                        >
                            <Eye className="h-4 w-4" />
                            View Locational Clearance
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!clearanceData}
                            onClick={() => clearanceData && printLocationalClearanceCopy(clearanceData, "cpdo")}
                        >
                            <Printer className="h-4 w-4" />
                            Print CPDO Received Copy
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!clearanceData}
                            onClick={() => clearanceData && printLocationalClearanceCopy(clearanceData, "client")}
                        >
                            <Printer className="h-4 w-4" />
                            Print Client Copy
                        </Button>
                        <Button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={!clearanceData}
                            onClick={() => clearanceData && printBothLocationalClearanceCopies(clearanceData)}
                        >
                            <Files className="h-4 w-4" />
                            Print Both Copies
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
