import * as React from "react"
import axiosInstance from "~/lib/axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface ImagePreviewModalProps {
    open: boolean
    onClose: () => void
    attachmentId: number
    fileName: string
}

export function ImagePreviewModal({ open, onClose, attachmentId, fileName }: ImagePreviewModalProps) {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!open) return

        let objectUrl: string | null = null
        let cancelled = false

        const loadPreview = async () => {
            setIsLoading(true)
            setError(null)
            setPreviewUrl(null)

            try {
                const response = await axiosInstance.get(`/api/attachments/${attachmentId}/preview`, {
                    responseType: "blob",
                })

                if (cancelled) return

                objectUrl = URL.createObjectURL(response.data)
                setPreviewUrl(objectUrl)
            } catch {
                if (!cancelled) {
                    setError("Failed to load image preview.")
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadPreview()

        return () => {
            cancelled = true
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl)
            }
        }
    }, [open, attachmentId])

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[92dvh] flex flex-col p-0 gap-0">
                <div className="px-6 py-4 border-b shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-[14px] text-zinc-800 truncate max-w-[600px]">
                            {fileName}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="flex-1 min-h-0 bg-zinc-100 flex items-center justify-center p-4 overflow-auto min-h-[50dvh]">
                    {isLoading && <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />}
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt={fileName}
                            className="max-w-full max-h-[75dvh] object-contain"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
