import * as React from "react"
import { format } from "date-fns"
import { Download, Eye, FileText, Trash2, CalendarPlus, ClipboardCheck } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { useMutation } from "@tanstack/react-query"
import { DocumentService } from "~/api/DocumentService"
import type { DocumentAttachment } from "~/api/DocumentService"
import { ViewDocumentTable } from "~/components/files/view-document-table"
import { PdfPreviewModal } from "~/components/files/pdf-preview-modal"
import { ExtendDueDateModal } from "~/components/documents/extend-due-date-modal"
import { InspectionReportModal } from "~/components/documents/inspection-report-modal"
import { useAuthStore } from "~/store/auth"
import { canExtendDueDate, canViewInspectionReport } from "~/lib/permissions"

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getFileExtColor(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
    const map: Record<string, string> = {
        pdf: "text-red-500",
        doc: "text-blue-600",
        docx: "text-blue-600",
        xls: "text-green-600",
        xlsx: "text-green-600",
        ppt: "text-orange-500",
        pptx: "text-orange-500",
        jpg: "text-purple-500",
        jpeg: "text-purple-500",
        png: "text-purple-500",
    }
    return map[ext] ?? "text-zinc-400"
}

export function formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === 0) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ─── FileCard ─────────────────────────────────────────────────────────────────
interface FileCardProps {
    attachment: DocumentAttachment
    onDeleted: () => void
}

export function FileCard({ attachment, onDeleted }: FileCardProps) {
    const { user } = useAuthStore()
    const canDelete = user?.roles?.some((role) =>
        role.permissions?.some((p: any) => p.resource === "Files" && p.name === "delete")
    )
    const canExtend = canExtendDueDate(user)
    const canInspectionReport = canViewInspectionReport(user)

    const [showDocument, setShowDocument] = React.useState(false)
    const [showPreview, setShowPreview] = React.useState(false)
    const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
    const [showExtendDueDate, setShowExtendDueDate] = React.useState(false)
    const [showInspectionReport, setShowInspectionReport] = React.useState(false)
    const [isDownloading, setIsDownloading] = React.useState(false)

    const isPdf = attachment.file_name.toLowerCase().endsWith(".pdf")

    const deleteMutation = useMutation({
        mutationFn: () => DocumentService.deleteAttachment(attachment.id),
        onSuccess: () => {
            onDeleted()
        },
    })

    const handleDownload = async () => {
        setIsDownloading(true)
        try {
            await DocumentService.downloadAttachment(attachment.id, attachment.file_name)
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="bg-white border border-zinc-200 rounded-md shadow-sm hover:shadow-md transition-shadow p-3 flex flex-col gap-2">
            {/* Date */}
            <p className="text-[11px] text-zinc-400">
                {attachment.created_at
                    ? format(new Date(attachment.created_at), "MMMM d, yyyy h:mm a")
                    : "—"}
            </p>

            {/* Filename */}
            <div className="flex items-start gap-2">
                <FileText
                    className={`h-5 w-5 shrink-0 mt-0.5 ${getFileExtColor(attachment.file_name)}`}
                />
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-zinc-800 break-words leading-snug">
                        {attachment.file_name}
                    </p>
                    {attachment.file_size !== null && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            {formatFileSize(attachment.file_size)}
                        </p>
                    )}
                </div>
            </div>

            {/* From */}
            {attachment.document && (
                <p className="text-[12px] text-zinc-500">
                    From:{" "}
                    <span className="font-medium text-zinc-700">
                        {attachment.document.document_title}
                    </span>
                </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {isPdf && (
                    <Button
                        size="sm"
                        className="h-7 text-[12px] px-2.5 bg-zinc-700 hover:bg-zinc-800 text-white gap-1"
                        onClick={() => setShowPreview(true)}
                    >
                        <Eye className="h-3 w-3" />
                        Preview
                    </Button>
                )}
                <Button
                    size="sm"
                    className="h-7 text-[12px] px-2.5 bg-green-600 hover:bg-green-700 text-white gap-1"
                    onClick={handleDownload}
                    disabled={isDownloading}
                >
                    <Download className="h-3 w-3" />
                    Download
                </Button>
                {canExtend && attachment.document?.due_date && (
                    <Button
                        size="sm"
                        className="h-7 text-[12px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                        onClick={() => setShowExtendDueDate(true)}
                    >
                        <CalendarPlus className="h-3 w-3" />
                        Add Number of Days
                    </Button>
                )}
                {canInspectionReport && attachment.document && (
                    <Button
                        size="sm"
                        className="h-7 text-[12px] px-2.5 bg-teal-600 hover:bg-teal-700 text-white gap-1"
                        onClick={() => setShowInspectionReport(true)}
                    >
                        <ClipboardCheck className="h-3 w-3" />
                        Inspection Report
                    </Button>
                )}
                {canDelete && (
                    <Button
                        size="sm"
                        className="h-7 text-[12px] px-2.5 bg-red-600 hover:bg-red-700 text-white gap-1"
                        onClick={() => setShowDeleteAlert(true)}
                        disabled={deleteMutation.isPending}
                    >
                        <Trash2 className="h-3 w-3" />
                        Delete
                    </Button>
                )}
            </div>

            {/* View Document link */}
            {attachment.document && (
                <button
                    onClick={() => setShowDocument((v) => !v)}
                    className="flex items-center gap-0.5 text-[12px] text-green-600 hover:text-zinc-800 transition-colors w-fit mt-1"
                >
                    <span className="text-zinc-400">→</span>
                    <span className="underline underline-offset-2">
                        {showDocument ? "Hide Document" : "View Document"}
                    </span>
                </button>
            )}

            {/* View Document Modal */}
            {attachment.document && (
                <ViewDocumentTable
                    attachment={attachment}
                    open={showDocument}
                    onClose={() => setShowDocument(false)}
                />
            )}

            {/* PDF Preview Modal */}
            {isPdf && (
                <PdfPreviewModal
                    open={showPreview}
                    onClose={() => setShowPreview(false)}
                    attachmentId={attachment.id}
                    fileName={attachment.file_name}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete File</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-semibold text-zinc-800">
                                {attachment.file_name}
                            </span>
                            ? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => deleteMutation.mutate()}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Extend Due Date Modal */}
            {attachment.document && (
                <ExtendDueDateModal
                    documentId={attachment.document.id}
                    documentTitle={attachment.document.document_title}
                    currentDueDate={attachment.document.due_date}
                    open={showExtendDueDate}
                    onClose={() => setShowExtendDueDate(false)}
                />
            )}

            {attachment.document && (
                <InspectionReportModal
                    documentId={attachment.document.id}
                    open={showInspectionReport}
                    onClose={() => setShowInspectionReport(false)}
                />
            )}
        </div>
    )
}

// ─── FileCardSkeleton ─────────────────────────────────────────────────────────
export function FileCardSkeleton() {
    return (
        <div className="bg-white border border-zinc-200 rounded-md shadow-sm p-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <div className="flex gap-2">
                <Skeleton className="h-5 w-5 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
            <Skeleton className="h-3 w-40" />
            <div className="flex gap-1.5">
                <Skeleton className="h-7 w-20 rounded" />
                <Skeleton className="h-7 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-24" />
        </div>
    )
}
