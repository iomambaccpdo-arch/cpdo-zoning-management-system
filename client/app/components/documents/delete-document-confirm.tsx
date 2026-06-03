"use client"

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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { DocumentService } from "~/api/DocumentService"
import { toast } from "sonner"

interface DeleteDocumentConfirmProps {
    documentId: number | null
    documentTitle?: string
    open: boolean
    onClose: () => void
}

export function DeleteDocumentConfirm({ documentId, documentTitle, open, onClose }: DeleteDocumentConfirmProps) {
    const queryClient = useQueryClient()

    const { mutate: deleteDocument, isPending } = useMutation({
        mutationFn: () => DocumentService.deleteDocument(documentId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["attachments"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] })
            toast.success("Document deleted successfully")
            onClose()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to delete document")
        },
    })

    return (
        <AlertDialog open={open} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete{" "}
                        <span className="font-semibold">{documentTitle || "this document"}</span>?
                        This will also remove all uploaded attachments. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isPending}
                        onClick={() => deleteDocument()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
