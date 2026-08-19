import { Badge } from "~/components/ui/badge"
import {
    documentStatusBadgeClass,
    documentStatusLabel,
} from "~/lib/document-status"
import { cn } from "~/lib/utils"

interface DocumentStatusBadgeProps {
    status?: string | null
    className?: string
}

export function DocumentStatusBadge({ status, className }: DocumentStatusBadgeProps) {
    return (
        <Badge
            variant="secondary"
            className={cn(
                "text-[11px] font-semibold tracking-wide",
                documentStatusBadgeClass(status),
                className
            )}
        >
            {documentStatusLabel(status)}
        </Badge>
    )
}
