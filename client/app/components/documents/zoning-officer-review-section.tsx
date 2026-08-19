import * as React from "react"
import { FileText, Upload } from "lucide-react"
import { DocumentService, type DocumentAttachment } from "~/api/DocumentService"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import {
    formatConditionsList,
    LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS,
} from "~/lib/locational-clearance-conditions"

export interface ZoningOfficerReviewValues {
    additionalConditions: string
    recommendedForApprovalName: string
    recommendedForApprovalDesignation: string
    approvedByName: string
    approvedByDesignation: string
    reviewedReport: File | null
}

export const defaultZoningOfficerReviewValues = (): ZoningOfficerReviewValues => ({
    additionalConditions: formatConditionsList(LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS),
    recommendedForApprovalName: "",
    recommendedForApprovalDesignation: "",
    approvedByName: "",
    approvedByDesignation: "",
    reviewedReport: null,
})

interface ZoningOfficerReviewSectionProps {
    editable: boolean
    values: ZoningOfficerReviewValues
    onChange: (values: ZoningOfficerReviewValues) => void
    errors: Partial<Record<keyof ZoningOfficerReviewValues, string>>
    existingAttachment?: DocumentAttachment | null
}

export function ZoningOfficerReviewSection({
    editable,
    values,
    onChange,
    errors,
    existingAttachment,
}: ZoningOfficerReviewSectionProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const update = <K extends keyof ZoningOfficerReviewValues>(
        key: K,
        value: ZoningOfficerReviewValues[K],
    ) => {
        onChange({ ...values, [key]: value })
    }

    return (
        <section className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-900">
                    Zoning Officer Review
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                    Upload the reviewed inspection report, record additional conditions, and specify
                    signatories for the Locational Clearance.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="reviewed-inspection-report">Reviewed Inspection Report (PDF)</Label>
                {existingAttachment && !editable && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                            <span className="truncate text-sm">{existingAttachment.file_name}</span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                DocumentService.downloadAttachment(
                                    existingAttachment.id,
                                    existingAttachment.file_name,
                                )
                            }
                        >
                            Download
                        </Button>
                    </div>
                )}
                {editable && (
                    <>
                        <input
                            ref={fileInputRef}
                            id="reviewed-inspection-report"
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null
                                update("reviewedReport", file)
                            }}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="mr-1 h-4 w-4" />
                                {values.reviewedReport ? "Replace PDF" : "Upload PDF"}
                            </Button>
                            <span className="text-sm text-zinc-600">
                                {values.reviewedReport?.name ?? "No file selected"}
                            </span>
                        </div>
                        {errors.reviewedReport && (
                            <p className="text-sm text-red-600">{errors.reviewedReport}</p>
                        )}
                    </>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="additional-conditions">Additional Conditions</Label>
                <Textarea
                    id="additional-conditions"
                    rows={6}
                    disabled={!editable}
                    value={values.additionalConditions}
                    onChange={(event) => update("additionalConditions", event.target.value)}
                    placeholder="Enter additional zoning conditions"
                />
                {errors.additionalConditions && (
                    <p className="text-sm text-red-600">{errors.additionalConditions}</p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                    <p className="text-sm font-medium text-zinc-800">Recommended for Approval</p>
                    <div className="space-y-2">
                        <Label htmlFor="recommended-name">Name</Label>
                        <Input
                            id="recommended-name"
                            disabled={!editable}
                            value={values.recommendedForApprovalName}
                            onChange={(event) =>
                                update("recommendedForApprovalName", event.target.value)
                            }
                        />
                        {errors.recommendedForApprovalName && (
                            <p className="text-sm text-red-600">
                                {errors.recommendedForApprovalName}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="recommended-designation">Designation</Label>
                        <Input
                            id="recommended-designation"
                            disabled={!editable}
                            placeholder="e.g. Zoning Officer III"
                            value={values.recommendedForApprovalDesignation}
                            onChange={(event) =>
                                update("recommendedForApprovalDesignation", event.target.value)
                            }
                        />
                        {errors.recommendedForApprovalDesignation && (
                            <p className="text-sm text-red-600">
                                {errors.recommendedForApprovalDesignation}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                    <p className="text-sm font-medium text-zinc-800">Approved By</p>
                    <div className="space-y-2">
                        <Label htmlFor="approved-name">Name</Label>
                        <Input
                            id="approved-name"
                            disabled={!editable}
                            value={values.approvedByName}
                            onChange={(event) => update("approvedByName", event.target.value)}
                        />
                        {errors.approvedByName && (
                            <p className="text-sm text-red-600">{errors.approvedByName}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="approved-designation">Designation</Label>
                        <Input
                            id="approved-designation"
                            disabled={!editable}
                            placeholder="e.g. City Planning & Development Coordinator"
                            value={values.approvedByDesignation}
                            onChange={(event) =>
                                update("approvedByDesignation", event.target.value)
                            }
                        />
                        {errors.approvedByDesignation && (
                            <p className="text-sm text-red-600">{errors.approvedByDesignation}</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
