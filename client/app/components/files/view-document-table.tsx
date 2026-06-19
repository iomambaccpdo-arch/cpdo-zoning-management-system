import { format } from "date-fns"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import type { DocumentAttachment } from "~/api/DocumentService"

interface ViewDocumentTableProps {
    attachment: DocumentAttachment
    open: boolean
    onClose: () => void
}

export function ViewDocumentTable({ attachment, open, onClose }: ViewDocumentTableProps) {
    const doc = attachment.document

    if (!doc) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent>
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No parent document information available.
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    const rows: { label: string; value: string | null | undefined }[] = [
        { label: "Document Title", value: doc.document_title },
        { label: "Application No.", value: doc.zoning_application_no },
        { label: "Type of Project", value: doc.project_type?.name },
        { label: "Specific Project Type", value: doc.specific_project_type?.name },
        { label: "Applicant Name", value: doc.applicant_name },
        {
            label: "Date of Application",
            value: doc.date_of_application
                ? format(new Date(doc.date_of_application), "MMMM d, yyyy")
                : null,
        },
        {
            label: "Due Date",
            value: doc.due_date ? format(new Date(doc.due_date), "MMMM d, yyyy") : null,
        },
        { label: "Barangay", value: doc.barangay?.name },
        { label: "Purok", value: doc.purok?.name },
        { label: "Landmark", value: doc.landmark },
    ]

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90dvh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-base text-zinc-800">Parent Document</DialogTitle>
                        <p className="text-sm font-medium text-zinc-600">{doc.document_title}</p>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[12px] font-semibold w-[200px]">Field</TableHead>
                                    <TableHead className="text-[12px] font-semibold">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.label} className="text-[13px]">
                                        <TableCell className="font-medium text-zinc-500">{row.label}</TableCell>
                                        <TableCell className="text-zinc-800">
                                            {row.value ?? (
                                                <span className="text-muted-foreground italic">N/A</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Routed To — rendered as pill badges */}
                                <TableRow className="text-[13px]">
                                    <TableCell className="font-medium text-zinc-500 align-top pt-3">
                                        Routed To
                                    </TableCell>
                                    <TableCell>
                                        {doc.routed_to_users && doc.routed_to_users.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 py-1">
                                                {doc.routed_to_users.map((u) => (
                                                    <span
                                                        key={u.id}
                                                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5"
                                                    >
                                                        {u.first_name} {u.last_name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic">N/A</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
