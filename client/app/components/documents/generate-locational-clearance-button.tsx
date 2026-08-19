import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { FileBadge } from "lucide-react"
import { toast } from "sonner"
import { DocumentService } from "~/api/DocumentService"
import type { Document } from "~/api/DocumentService"
import { printLocationalClearance } from "~/components/documents/locational-clearance-print"
import { Button } from "~/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { checkLocationalClearanceEligibility } from "~/lib/locational-clearance-utils"
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
    title = "Generate Locational Clearance",
}: GenerateLocationalClearanceButtonProps) {
    const { user } = useAuthStore()
    const canGenerate = canGenerateLocationalClearance(user)

    const hasFullContext =
        document.status === "approved" &&
        document.inspection_report !== undefined

    const eligibility = hasFullContext
        ? checkLocationalClearanceEligibility(document)
        : null

    const generateMutation = useMutation({
        mutationFn: () => DocumentService.generateLocationalClearance(document.id),
        onSuccess: (response) => {
            printLocationalClearance(response.data)
            toast.success("Locational Clearance generated. Opening print dialog…")
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

    if (!canGenerate || document.status !== "approved") {
        return null
    }

    const isDisabled = (eligibility !== null && !eligibility.eligible) || generateMutation.isPending

    const button = (
        <Button
            size={size}
            variant={variant}
            className={className}
            disabled={isDisabled}
            title={title}
            onClick={() => generateMutation.mutate()}
        >
            <FileBadge className={showLabel && !iconOnly ? "h-4 w-4 mr-1" : "h-4 w-4"} />
            {showLabel && !iconOnly && "Generate Locational Clearance"}
        </Button>
    )

    if (!eligibility || eligibility.eligible) {
        return button
    }

    return (
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
    )
}
