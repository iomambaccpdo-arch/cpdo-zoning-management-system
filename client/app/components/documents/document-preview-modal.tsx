"use client"

import { format } from "date-fns"
import { FileText, Paperclip } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import type { Document } from "~/api/DocumentService"
import { formatArea } from "~/lib/measurement-utils"
import { formatZoningClassificationName } from "~/lib/zoning-utils"
import {
    COORDINATES_VERIFICATION_STATUSES,
    getCoordinatesVerificationStatus,
    resolveVerifiedCoordinates,
} from "~/lib/inspection-report-utils"
import { Badge } from "~/components/ui/badge"

interface DocumentPreviewModalProps {
    document: Document | null
    open: boolean
    onClose: () => void
}

function Field({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm mt-0.5">{value || <span className="text-muted-foreground italic">N/A</span>}</p>
        </div>
    )
}

export function DocumentPreviewModal({ document, open, onClose }: DocumentPreviewModalProps) {
    if (!document) return null

    const report = document.inspection_report
    const coordinatesStatus = report
        ? getCoordinatesVerificationStatus(
            document.coordinates,
            report.field_verifications,
            report.gps_coordinates,
        )
        : null
    const verifiedCoordinates = report
        ? resolveVerifiedCoordinates(
            document.coordinates,
            report.field_verifications,
            report.gps_coordinates,
        )
        : null
    const coordinatesStatusClass =
        coordinatesStatus === COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECT
            ? "border-transparent bg-emerald-600 text-white"
            : coordinatesStatus === COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECTED
                ? "border-transparent bg-amber-600 text-white"
                : "border-transparent bg-slate-500 text-white"

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[90dvh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-base">{document.document_title}</DialogTitle>
                        <p className="text-sm text-muted-foreground">{document.zoning_application_no}</p>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Step 1 – Document Info */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-blue-700">Document Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label="Zoning"
                                value={formatZoningClassificationName(document.zoning?.name) || null}
                            />
                            <Field label="Type of Project" value={document.project_type?.name} />
                            <Field label="Specific Project Type" value={document.specific_project_type?.name} />
                            <Field label="Date of Application" value={document.date_of_application ? format(new Date(document.date_of_application), "MMMM d, yyyy") : null} />
                            <Field label="Due Date" value={document.due_date ? format(new Date(document.due_date), "MMMM d, yyyy") : null} />
                        </div>
                    </section>

                    {/* Step 2 – Personnel */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-green-700">Personnel</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Applicant Name" value={document.applicant_name} />
                            <Field label="Received By" value={document.received_by} />
                            <Field label="Assisted By" value={document.assisted_by} />
                            <Field label="OIC" value={document.oic} />
                        </div>
                        {document.routed_to_users && document.routed_to_users.length > 0 && (
                            <div className="mt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Routed To</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {document.routed_to_users.map(u => (
                                        <span key={u.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                                            {u.first_name} {u.last_name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Step 3 – Location */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-purple-700">Location</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Barangay" value={document.barangay?.name} />
                            <Field label="Purok" value={document.purok?.name} />
                            <Field label="Landmark" value={document.landmark} />
                            <Field label="Encoded Coordinates" value={document.coordinates} />
                            {report && (
                                <>
                                    <Field
                                        label="Verified / Actual Coordinates"
                                        value={verifiedCoordinates || null}
                                    />
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Coordinate Verification
                                        </p>
                                        <Badge
                                            variant="secondary"
                                            className={`mt-1 text-[11px] font-semibold tracking-wide ${coordinatesStatusClass}`}
                                        >
                                            {coordinatesStatus}
                                        </Badge>
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* Step 4 – Property */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-orange-700">Property Details</h3>
                        <div className="space-y-4">
                            {(document.buildings?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Buildings</p>
                                    {document.buildings?.map((building, index) => (
                                        <div key={`preview-building-${index}`} className="grid grid-cols-2 gap-4">
                                            <Field label={`Building ${index + 1} Name`} value={building.name} />
                                            <Field
                                                label={`Building ${index + 1} Area`}
                                                value={formatArea(building.area) || null}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(document.lots?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Lots</p>
                                    {document.lots?.map((lot, index) => (
                                        <div key={`preview-lot-${index}`} className="grid grid-cols-2 gap-4">
                                            <Field label={`Lot ${index + 1} Land Title / TCT`} value={lot.land_title} />
                                            <Field
                                                label={`Lot ${index + 1} Area`}
                                                value={formatArea(lot.area) || null}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!(document.buildings?.length || document.lots?.length) && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Floor Area" value={formatArea(document.floor_area) || null} />
                                    <Field label="Lot Area" value={formatArea(document.lot_area) || null} />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Storey" value={document.storey} />
                                <Field label="Mezzanine" value={document.mezanine} />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-indigo-700">Locational Clearance Payment</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="OR No." value={document.or_number} />
                            <Field
                                label="Amount Paid"
                                value={
                                    document.amount_paid === null || document.amount_paid === undefined || document.amount_paid === ""
                                        ? null
                                        : `₱${Number(document.amount_paid).toLocaleString("en-PH", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                          })}`
                                }
                            />
                            <Field
                                label="Date Paid"
                                value={document.date_paid ? format(new Date(document.date_paid), "MMMM d, yyyy") : null}
                            />
                            <Field
                                label="Date Complete Requirements Complied"
                                value={
                                    document.date_requirements_complied
                                        ? format(new Date(document.date_requirements_complied), "MMMM d, yyyy")
                                        : null
                                }
                            />
                        </div>
                    </section>

                    {/* Attachments */}
                    {document.attachments && document.attachments.length > 0 && (
                        <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-zinc-700">
                                <Paperclip className="h-3.5 w-3.5" /> Attachments ({document.attachments.length})
                            </h3>
                            <div className="space-y-2">
                                {document.attachments.map(att => (
                                    <div key={att.id} className="flex items-center gap-3 p-2 rounded border text-sm bg-zinc-50">
                                        <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                                        <span className="flex-1 truncate">{att.file_name}</span>
                                        {att.file_size && (
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {(att.file_size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
