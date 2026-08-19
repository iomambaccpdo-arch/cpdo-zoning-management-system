import * as React from "react"
import axiosInstance from "~/lib/axios"
import { consumeAuthenticatedImagePreview } from "~/lib/authenticated-image-cache"
import { Loader2 } from "lucide-react"

interface AuthenticatedImageProps {
    attachmentId: number
    alt: string
    className?: string
}

export function AuthenticatedImage({ attachmentId, alt, className }: AuthenticatedImageProps) {
    const [src, setSrc] = React.useState<string | null>(null)
    const [failed, setFailed] = React.useState(false)

    React.useEffect(() => {
        let objectUrl: string | null = null
        let ownsObjectUrl = false
        let cancelled = false

        const load = async () => {
            const seededPreview = consumeAuthenticatedImagePreview(attachmentId)
            if (seededPreview) {
                if (!cancelled) {
                    objectUrl = seededPreview
                    ownsObjectUrl = true
                    setSrc(seededPreview)
                    setFailed(false)
                }
                return
            }

            try {
                const response = await axiosInstance.get(`/api/attachments/${attachmentId}/preview`, {
                    responseType: "blob",
                })

                if (cancelled) return

                objectUrl = URL.createObjectURL(response.data)
                ownsObjectUrl = true
                setSrc(objectUrl)
                setFailed(false)
            } catch {
                if (!cancelled) {
                    setFailed(true)
                }
            }
        }

        void load()

        return () => {
            cancelled = true
            if (ownsObjectUrl && objectUrl) {
                URL.revokeObjectURL(objectUrl)
            }
        }
    }, [attachmentId])

    if (failed) {
        return (
            <div className={`flex items-center justify-center bg-zinc-200 text-[11px] text-zinc-500 ${className ?? ""}`}>
                Unavailable
            </div>
        )
    }

    if (!src) {
        return (
            <div className={`flex items-center justify-center bg-zinc-100 ${className ?? ""}`}>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
        )
    }

    return <img src={src} alt={alt} className={className} />
}
