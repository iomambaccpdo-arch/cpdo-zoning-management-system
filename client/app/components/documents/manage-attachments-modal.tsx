import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Download, Eye, Plus, Trash2, Upload, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { AccountService } from "~/api/AccountService"
import { DocumentService } from "~/api/DocumentService"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { PdfPreviewModal } from "~/components/files/pdf-preview-modal"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { useAuthStore } from "~/store/auth"

interface ManageAttachmentsModalProps {
    documentId: number | null
    open: boolean
    onClose: () => void
}

export function ManageAttachmentsModal({ documentId, open, onClose }: ManageAttachmentsModalProps) {
    const { user } = useAuthStore()
    const canReplaceAttachments = user?.roles?.some(
        (role) => role.name === "Coordinator" || role.name === "Super Admin"
    ) ?? false

    const queryClient = useQueryClient()
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const replaceFileInputRef = React.useRef<HTMLInputElement>(null)
    const [preview, setPreview] = React.useState<{ id: number; fileName: string } | null>(null)
    const [selectedAttachmentIds, setSelectedAttachmentIds] = React.useState<number[]>([])
    const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(null)
    const [selectedOicUserId, setSelectedOicUserId] = React.useState<string>("")

    const { data: document } = useQuery({
        queryKey: ["document", documentId],
        queryFn: () => DocumentService.getDocument(documentId!),
        enabled: open && !!documentId,
    })

    const { data: attachments, isLoading } = useQuery({
        queryKey: ["document-attachments", documentId],
        queryFn: () => DocumentService.getDocumentAttachments(documentId!),
        enabled: open && !!documentId,
    })

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: () => AccountService.getUsers({ per_page: 100 }),
        enabled: open,
    })

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["document", documentId] })
        queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] })
        queryClient.invalidateQueries({ queryKey: ["attachments"] })
        queryClient.invalidateQueries({ queryKey: ["documents"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    }

    const uploadMutation = useMutation({
        mutationFn: (files: File[]) => DocumentService.uploadDocumentAttachments(documentId!, files),
        onSuccess: () => {
            toast.success("Attachments uploaded successfully")
            invalidateAll()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to upload attachments")
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (attachmentId: number) => DocumentService.deleteAttachment(attachmentId),
        onSuccess: () => {
            toast.success("Attachment deleted successfully")
            setPendingDeleteId(null)
            invalidateAll()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to delete attachment")
        },
    })

    const replaceMutation = useMutation({
        mutationFn: async (files: File[]) => {
            for (const attachmentId of selectedAttachmentIds) {
                await DocumentService.deleteAttachment(attachmentId)
            }
            await DocumentService.uploadDocumentAttachments(documentId!, files)
        },
        onSuccess: () => {
            toast.success("Attachments replaced successfully")
            setSelectedAttachmentIds([])
            invalidateAll()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to replace attachments")
        },
    })

    const updateOicMutation = useMutation({
        mutationFn: (userId: number) => DocumentService.updateOic(documentId!, userId),
        onSuccess: () => {
            toast.success("OIC updated successfully")
            setSelectedOicUserId("")
            invalidateAll()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to update OIC")
        },
    })

    const updateStatusMutation = useMutation({
        mutationFn: (status: string) => DocumentService.updateStatus(documentId!, status),
        onSuccess: () => {
            toast.success("Document status updated successfully")
            invalidateAll()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to update document status")
        },
    })

    const handleFilesSelected = (fileList: FileList | null, mode: "append" | "replace") => {
        if (!fileList || fileList.length === 0) {
            return
        }

        const files = Array.from(fileList).filter((file) => file.type === "application/pdf")
        if (files.length === 0) {
            toast.error("Please upload PDF files only")
            return
        }

        if (mode === "replace") {
            if (!canReplaceAttachments) {
                return
            }
            if (selectedAttachmentIds.length === 0) {
                toast.error("Select at least one existing attachment to replace")
                return
            }
            replaceMutation.mutate(files)
            return
        }

        uploadMutation.mutate(files)
    }

    const toggleAttachmentSelection = (attachmentId: number, checked: boolean) => {
        setSelectedAttachmentIds((current) =>
            checked ? [...current, attachmentId] : current.filter((id) => id !== attachmentId)
        )
    }

    const isMutating = uploadMutation.isPending || replaceMutation.isPending || deleteMutation.isPending || updateOicMutation.isPending || updateStatusMutation.isPending

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[980px] w-[96vw] max-h-[92dvh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Manage Attachments</DialogTitle>
                        <DialogDescription>
                            {document
                                ? `${document.document_title} (${document.zoning_application_no})`
                                : "Document attachment lifecycle management"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 flex-wrap py-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                handleFilesSelected(e.target.files, "append")
                                e.target.value = ""
                            }}
                        />
                        {canReplaceAttachments && (
                            <input
                                ref={replaceFileInputRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    handleFilesSelected(e.target.files, "replace")
                                    e.target.value = ""
                                }}
                            />
                        )}
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isMutating}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Upload Additional PDFs
                        </Button>
                        {document && (document.status === 'completed' || document.status === 'finalized') && (
                            <div className="flex items-center gap-2">
                                <select
                                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={selectedOicUserId}
                                    onChange={(e) => setSelectedOicUserId(e.target.value)}
                                    disabled={isMutating}
                                >
                                    <option value="">Select OIC from records...</option>
                                    {users?.data
                                        ?.filter(u => !u.roles.some((r: any) => r.name === 'Super Admin'))
                                        .map(user => (
                                            <option key={user.id} value={user.id.toString()}>
                                                {user.first_name} {user.last_name}{user.designation ? ` — ${user.designation}` : ""}
                                            </option>
                                        ))
                                    }
                                </select>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => {
                                        if (!selectedOicUserId) {
                                            toast.error("Please select an OIC first")
                                            return
                                        }
                                        updateOicMutation.mutate(parseInt(selectedOicUserId))
                                    }}
                                    disabled={isMutating || !selectedOicUserId}
                                >
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    Set OIC
                                </Button>
                                {document.oic && (
                                    <span className="text-xs text-muted-foreground">
                                        Current: <span className="font-medium text-foreground">{document.oic}</span>
                                    </span>
                                )}
                            </div>
                        )}
                        {canReplaceAttachments && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => replaceFileInputRef.current?.click()}
                                    disabled={isMutating || selectedAttachmentIds.length === 0}
                                >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Replace Selected
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    Selected for replace: {selectedAttachmentIds.length}
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap py-2 border-t">
                        <span className="text-sm font-medium">Document Status:</span>
                        {document && (
                            <Select
                                value={document.status || 'pending'}
                                onValueChange={(value) => updateStatusMutation.mutate(value)}
                                disabled={isMutating}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="finalized">Finalized</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="border rounded-md overflow-auto flex-1">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {canReplaceAttachments && (
                                        <TableHead className="w-[52px]">Pick</TableHead>
                                    )}
                                    <TableHead>Attachment</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead>Date Uploaded</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={canReplaceAttachments ? 5 : 4} className="text-center py-8 text-muted-foreground">
                                            Loading attachments...
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!isLoading && (!attachments || attachments.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={canReplaceAttachments ? 5 : 4} className="text-center py-8 text-muted-foreground">
                                            No attachments found for this document.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!isLoading && attachments?.map((attachment) => (
                                    <TableRow key={attachment.id}>
                                        {canReplaceAttachments && (
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedAttachmentIds.includes(attachment.id)}
                                                    onCheckedChange={(checked) =>
                                                        toggleAttachmentSelection(attachment.id, checked === true)
                                                    }
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className="font-medium">{attachment.file_name}</TableCell>
                                        <TableCell>
                                            {attachment.uploader
                                                ? `${attachment.uploader.first_name} ${attachment.uploader.last_name}`
                                                : "Unknown"}
                                        </TableCell>
                                        <TableCell>
                                            {attachment.created_at
                                                ? format(new Date(attachment.created_at), "MMM d, yyyy h:mm a")
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0"
                                                title="Preview"
                                                onClick={() => setPreview({ id: attachment.id, fileName: attachment.file_name })}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-blue-600"
                                                title="Download"
                                                onClick={() =>
                                                    DocumentService.downloadAttachment(attachment.id, attachment.file_name)
                                                }
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-red-600"
                                                title="Delete"
                                                onClick={() => setPendingDeleteId(attachment.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {preview && (
                <PdfPreviewModal
                    open={!!preview}
                    onClose={() => setPreview(null)}
                    attachmentId={preview.id}
                    fileName={preview.fileName}
                />
            )}

            <AlertDialog open={pendingDeleteId !== null} onOpenChange={() => setPendingDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the selected attachment from this document.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (pendingDeleteId) {
                                    deleteMutation.mutate(pendingDeleteId)
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
