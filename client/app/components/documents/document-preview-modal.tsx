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
                            <Field label="Zoning" value={document.zoning?.name} />
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
                            <Field label="Coordinates" value={document.coordinates} />
                        </div>
                    </section>

                    {/* Step 4 – Property */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 text-orange-700">Property Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Floor Area" value={document.floor_area ? `${document.floor_area} sqm` : null} />
                            <Field label="Lot Area" value={document.lot_area ? `${document.lot_area} sqm` : null} />
                            <Field label="Storey" value={document.storey} />
                            <Field label="Mezzanine" value={document.mezanine} />
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
