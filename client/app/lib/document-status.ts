export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
    encoding: "Encoding",
    returned: "Returned",
    encoded: "Encoded",
    inspected: "Inspected",
    reviewed: "Reviewed",
    approved: "Approved",
    // Legacy labels (pre-automation)
    pending: "Encoded",
    processing: "Inspected",
    completed: "Approved",
    finalized: "Approved",
}

/**
 * Color coding for Dashboard Status column:
 * - Encoding: gray (draft)
 * - Returned: orange (needs correction)
 * - Encoded / pending: blue (awaiting next step)
 * - Inspected: indigo
 * - Reviewed: cyan
 * - Approved / completed: green
 */
export function documentStatusBadgeClass(status?: string | null): string {
    switch (status) {
        case "encoding":
            return "border-transparent bg-slate-500 text-white hover:bg-slate-500"
        case "returned":
            return "border-transparent bg-orange-500 text-white hover:bg-orange-500"
        case "encoded":
        case "pending":
            return "border-transparent bg-blue-600 text-white hover:bg-blue-600"
        case "inspected":
        case "processing":
            return "border-transparent bg-indigo-600 text-white hover:bg-indigo-600"
        case "reviewed":
            return "border-transparent bg-cyan-600 text-white hover:bg-cyan-600"
        case "approved":
        case "completed":
        case "finalized":
            return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600"
        default:
            return "border-transparent bg-zinc-500 text-white hover:bg-zinc-500"
    }
}

export function documentStatusLabel(status?: string | null): string {
    const key = status ?? "encoding"
    return DOCUMENT_STATUS_LABELS[key] ?? key
}
