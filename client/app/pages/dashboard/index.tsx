import * as React from "react"
import { format } from "date-fns"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileText, X, ChevronLeft, ChevronRight, Loader2, Download, Eye, Pencil, FolderOpen, Trash2, Search, AlertTriangle, ClipboardCheck } from "lucide-react"
import { Input } from "~/components/ui/input"
import { DocumentService } from "~/api/DocumentService"
import type { DashboardMonthCount } from "~/api/DocumentService"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { PdfPreviewModal } from "~/components/files/pdf-preview-modal"
import { EditDocumentModal } from "~/components/documents/edit-document-modal"
import { ManageAttachmentsModal } from "~/components/documents/manage-attachments-modal"
import { DeleteDocumentConfirm } from "~/components/documents/delete-document-confirm"
import { InspectionReportModal } from "~/components/documents/inspection-report-modal"
import { useAuthStore } from "~/store/auth"
import type { User } from "~/store/auth"
import {
    canDeleteFile,
    canEditDocument as canEditDocumentForStatus,
    canGenerateLocationalClearance,
    canSubmitApplication as canSubmitApplicationPermission,
    canViewInspectionReport,
    isEncoderClerk,
} from "~/lib/permissions"
import { GenerateLocationalClearanceButton } from "~/components/documents/generate-locational-clearance-button"
import { LocationalClearancePaymentButton } from "~/components/documents/locational-clearance-payment-button"
import { DocumentStatusBadge } from "~/components/documents/document-status-badge"
import { formatPurokName } from "~/lib/document-property-utils"

// ─── Year helpers ───────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1 // 1-indexed
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

type DashboardTab = "overview" | "overdue" | "drafts" | "returned"

type DocumentsTableProps = {
    user: User | null
    year: number
    month?: number
    monthName?: string
    search: string
    status?: string
    headerTitle: string
    headerSubtitle?: string
    onClose?: () => void
    onSubmitApplication: (documentId: number) => void
    onEditDocument: (documentId: number) => void
    onManageAttachments: (documentId: number) => void
    onInspectionReport: (documentId: number) => void
    onDeleteDocument: (documentId: number, documentTitle: string) => void
}

// ─── Documents table (month view or search results) ───────────────────────────
function DocumentsTable({
    user,
    year,
    month,
    monthName,
    search,
    status,
    headerTitle,
    headerSubtitle,
    onClose,
    onSubmitApplication,
    onEditDocument,
    onManageAttachments,
    onInspectionReport,
    onDeleteDocument,
}: DocumentsTableProps) {
    const [page, setPage] = React.useState(1)
    const canViewFiles = user?.roles?.some((role) =>
        role.permissions?.some((p) => p.resource === "Files" && p.name === "view")
    ) ?? false
    const canDeleteDocument = canDeleteFile(user)
    const canInspectionReport = canViewInspectionReport(user)
    const canGenerateLc = canGenerateLocationalClearance(user)
    const canSubmitApplication = canSubmitApplicationPermission(user)

    React.useEffect(() => {
        setPage(1)
    }, [search, year, month, status])

    const { data, isLoading } = useQuery({
        queryKey: ["documents", year, month, search, status, page],
        queryFn: () =>
            DocumentService.getDocuments({
                year: year > 0 ? year : undefined,
                month,
                search: search || undefined,
                status,
                page,
                per_page: 10,
            }),
    })

    const docs = data?.data ?? []
    const totalPages = data?.last_page ?? 1

    return (
        <div className="mt-4 rounded-md border bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50 gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">
                        {search ? "Search results" : "Documents for"}
                    </p>
                    <p className="text-[14px] font-bold text-zinc-800 truncate">
                        {headerTitle}
                    </p>
                    <p className="text-[12px] text-zinc-500 mt-0.5">
                        {data?.total ?? "..."} document{(data?.total ?? 0) === 1 ? "" : "s"}
                        {headerSubtitle ? ` · ${headerSubtitle}` : ""}
                        {!headerSubtitle && (
                            <> &nbsp;·&nbsp; (C) City Planning Development Office</>
                        )}
                    </p>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-full p-1.5 hover:bg-zinc-200 transition-colors text-zinc-500"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Table */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-[12px] font-semibold">Date</TableHead>
                        <TableHead className="text-[12px] font-semibold">Title</TableHead>
                        <TableHead className="text-[12px] font-semibold">App No.</TableHead>
                        <TableHead className="text-[12px] font-semibold">Type</TableHead>
                        <TableHead className="text-[12px] font-semibold">Applicant</TableHead>
                        <TableHead className="text-[12px] font-semibold">Status</TableHead>
                        <TableHead className="text-[12px] font-semibold">Received by</TableHead>
                        <TableHead className="text-[12px] font-semibold">Location</TableHead>
                        <TableHead className="text-[12px] font-semibold text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading &&
                        Array.from({ length: 4 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 9 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    {!isLoading && docs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                                <FileText className="h-7 w-7 mx-auto mb-2 opacity-30" />
                                <p className="text-[13px]">
                                    {search
                                        ? "No documents match your search."
                                        : monthName
                                          ? `No documents for ${monthName}${year > 0 ? ` ${year}` : ""}.`
                                          : "No documents found."}
                                </p>
                            </TableCell>
                        </TableRow>
                    )}
                    {!isLoading &&
                        docs.map((doc) => (
                            <TableRow key={doc.id} className="hover:bg-zinc-50 text-[13px]">
                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                    {doc.created_at
                                        ? format(new Date(doc.created_at), "MMM d, yyyy h:mm a")
                                        : "—"}
                                </TableCell>
                                <TableCell className="font-medium max-w-[160px] truncate">
                                    {doc.document_title}
                                </TableCell>
                                <TableCell className="font-mono text-[12px]">
                                    {doc.zoning_application_no}
                                </TableCell>
                                <TableCell className="text-blue-600 max-w-[120px] truncate">
                                    {doc.project_type?.name ?? "—"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                    {doc.applicant_name}
                                </TableCell>
                                <TableCell>
                                    <DocumentStatusBadge status={doc.status} />
                                </TableCell>
                                <TableCell className="max-w-[130px] truncate">
                                    {doc.received_by ?? "—"}
                                </TableCell>
                                <TableCell className="max-w-[140px] truncate">
                                    {doc.barangay?.name && doc.purok?.name
                                        ? `${doc.barangay.name}, ${formatPurokName(doc.purok.name)}`
                                        : "—"}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    {canEditDocumentForStatus(user, doc.status) && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-emerald-700 hover:bg-emerald-50"
                                            onClick={() => onEditDocument(doc.id)}
                                            title="Edit Document"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canSubmitApplication && (doc.status === "encoding" || doc.status === "returned") && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-green-700 hover:bg-green-50"
                                            onClick={() => onSubmitApplication(doc.id)}
                                            title="Submit for Processing"
                                        >
                                            <ClipboardCheck className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canViewFiles && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-purple-700 hover:bg-purple-50"
                                            onClick={() => onManageAttachments(doc.id)}
                                            title="Manage Attachments"
                                        >
                                            <FolderOpen className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canViewFiles && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                            disabled={!doc.attachments || doc.attachments.length === 0}
                                            onClick={() => {
                                                const latestAttachment = [...(doc.attachments ?? [])].sort(
                                                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                                )[0]
                                                if (latestAttachment) {
                                                    DocumentService.downloadAttachment(latestAttachment.id, latestAttachment.file_name)
                                                }
                                            }}
                                            title="Download Latest Attachment"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canInspectionReport && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-teal-700 hover:bg-teal-50"
                                            onClick={() => onInspectionReport(doc.id)}
                                            title="Inspection Report"
                                        >
                                            <ClipboardCheck className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <LocationalClearancePaymentButton
                                        document={doc}
                                        iconOnly
                                        showLabel={false}
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-indigo-700 hover:bg-indigo-50"
                                    />
                                    {canGenerateLc && doc.status === "approved" && (
                                        <GenerateLocationalClearanceButton
                                            document={doc}
                                            iconOnly
                                            showLabel={false}
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-indigo-700 hover:bg-indigo-50"
                                        />
                                    )}
                                    {canDeleteDocument && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                            onClick={() => onDeleteDocument(doc.id, doc.document_title)}
                                            title="Delete Document"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 px-4 py-2 border-t">
                    <span className="text-xs text-muted-foreground">
                        Page {data?.current_page} of {totalPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    )
}

type OverdueApplicationsTableProps = {
    user: User | null
    onEditDocument: (documentId: number) => void
    onManageAttachments: (documentId: number) => void
    onInspectionReport: (documentId: number) => void
    onDeleteDocument: (documentId: number, documentTitle: string) => void
}

function OverdueApplicationsTable({
    user,
    onEditDocument,
    onManageAttachments,
    onInspectionReport,
    onDeleteDocument,
}: OverdueApplicationsTableProps) {
    const [page, setPage] = React.useState(1)
    const canViewFiles = user?.roles?.some((role) =>
        role.permissions?.some((p) => p.resource === "Files" && p.name === "view")
    ) ?? false
    const canDeleteDocument = canDeleteFile(user)
    const canInspectionReport = canViewInspectionReport(user)

    const { data, isLoading } = useQuery({
        queryKey: ["documents", "overdue", page],
        queryFn: () =>
            DocumentService.getOverdueDocuments({
                page,
                per_page: 10,
            }),
    })

    const docs = data?.data ?? []
    const totalPages = data?.last_page ?? 1
    const total = data?.total ?? 0

    return (
        <div className="space-y-4">
            {total > 0 && (
                <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[13px] font-semibold text-red-800">
                            Action required — {total} overdue application{total === 1 ? "" : "s"}
                        </p>
                        <p className="text-[12px] text-red-700 mt-0.5">
                            The following applications have passed their due date and are still pending or in progress.
                        </p>
                    </div>
                </div>
            )}

            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50 gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">
                            Monitoring
                        </p>
                        <p className="text-[14px] font-bold text-zinc-800 truncate">
                            Overdue Applications
                        </p>
                        <p className="text-[12px] text-zinc-500 mt-0.5">
                            {isLoading ? "..." : total} application{total === 1 ? "" : "s"} past due date
                        </p>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-[12px] font-semibold">Applicant</TableHead>
                            <TableHead className="text-[12px] font-semibold">App No.</TableHead>
                            <TableHead className="text-[12px] font-semibold">Due Date</TableHead>
                            <TableHead className="text-[12px] font-semibold">Days Overdue</TableHead>
                            <TableHead className="text-[12px] font-semibold">Status</TableHead>
                            <TableHead className="text-[12px] font-semibold text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading &&
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 6 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        {!isLoading && docs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                    <FileText className="h-7 w-7 mx-auto mb-2 opacity-30" />
                                    <p className="text-[13px]">No overdue applications. All documents are on track.</p>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading &&
                            docs.map((doc) => (
                                <TableRow
                                    key={doc.id}
                                    className="hover:bg-red-50/40 text-[13px] border-l-4 border-l-red-500"
                                >
                                    <TableCell className="font-medium max-w-[180px] truncate">
                                        {doc.applicant_name}
                                    </TableCell>
                                    <TableCell className="font-mono text-[12px]">
                                        {doc.zoning_application_no}
                                    </TableCell>
                                    <TableCell className="text-red-700 font-medium whitespace-nowrap">
                                        {doc.due_date
                                            ? format(new Date(doc.due_date), "MMM d, yyyy")
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="destructive"
                                            className="text-[11px] font-semibold"
                                        >
                                            {doc.days_overdue} day{doc.days_overdue === 1 ? "" : "s"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DocumentStatusBadge status={doc.status} />
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {canEditDocumentForStatus(user, doc.status) && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => onEditDocument(doc.id)}
                                                title="Edit Document"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canViewFiles && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-purple-700 hover:bg-purple-50"
                                                onClick={() => onManageAttachments(doc.id)}
                                                title="Manage Attachments"
                                            >
                                                <FolderOpen className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canInspectionReport && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-teal-700 hover:bg-teal-50"
                                            onClick={() => onInspectionReport(doc.id)}
                                            title="Inspection Report"
                                        >
                                            <ClipboardCheck className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canDeleteDocument && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                                onClick={() => onDeleteDocument(doc.id, doc.document_title)}
                                                title="Delete Document"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 px-4 py-2 border-t">
                        <span className="text-xs text-muted-foreground">
                            Page {data?.current_page} of {totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = React.useState<DashboardTab>("overview")
    const [selectedYear, setSelectedYear] = React.useState(CURRENT_YEAR)
    const [selectedMonth, setSelectedMonth] = React.useState<DashboardMonthCount | null>(null)
    const [docSearch, setDocSearch] = React.useState("")
    const [debouncedDocSearch, setDebouncedDocSearch] = React.useState("")

    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedDocSearch(docSearch.trim()), 400)
        return () => clearTimeout(timer)
    }, [docSearch])
    const [previewAttachment, setPreviewAttachment] = React.useState<{ id: number; fileName: string } | null>(null)
    const [editDocumentId, setEditDocumentId] = React.useState<number | null>(null)
    const [manageDocumentId, setManageDocumentId] = React.useState<number | null>(null)
    const [deleteDocumentId, setDeleteDocumentId] = React.useState<number | null>(null)
    const [deleteDocumentTitle, setDeleteDocumentTitle] = React.useState<string>("")
    const [inspectionReportDocumentId, setInspectionReportDocumentId] = React.useState<number | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", selectedYear],
        queryFn: () => DocumentService.getDashboard(selectedYear),
    })

    const monthlyCounts = data?.monthly_counts ?? []
    const recentAttachments = data?.recent_attachments ?? []
    const overdueCount = data?.overdue_count ?? 0
    const encodingCount = data?.encoding_count ?? 0
    const returnedCount = data?.returned_count ?? 0
    const isEncoder = isEncoderClerk(user)
    const canViewFiles = user?.roles?.some((role) =>
        role.permissions?.some((p) => p.resource === "Files" && p.name === "view")
    ) ?? false

    const submitApplicationMutation = useMutation({
        mutationFn: (documentId: number) => DocumentService.submitApplication(documentId),
        onSuccess: () => {
            toast.success("Application submitted successfully")
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to submit application")
        },
    })

    const handleSubmitApplication = (documentId: number) => {
        submitApplicationMutation.mutate(documentId)
    }

    // Pre-select current month once data loads
    React.useEffect(() => {
        if (monthlyCounts.length > 0 && selectedMonth === null) {
            const currentMonthCard = monthlyCounts.find(m => m.month === CURRENT_MONTH)
            if (currentMonthCard) setSelectedMonth(currentMonthCard)
        }
    }, [monthlyCounts])

    const handleCardClick = (m: DashboardMonthCount) => {
        // Toggle off if same card is clicked again
        setSelectedMonth((prev) =>
            prev?.month === m.month ? null : m
        )
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 border-t border-zinc-200">
            {/* Page header */}
            <div className="px-5 py-3 border-b bg-white shrink-0">
                <h1 className="text-[16px] font-bold text-[#1a202c] tracking-tight uppercase leading-none mt-1">
                    Dashboard
                </h1>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-6">

                {/* ── Dashboard tabs ── */}
                <div className="flex items-center gap-1 border-b border-zinc-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                            activeTab === "overview"
                                ? "border-green-600 text-green-700"
                                : "border-transparent text-zinc-500 hover:text-zinc-700"
                        }`}
                    >
                        Overview
                    </button>
                    {isEncoder && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("drafts")}
                            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === "drafts"
                                    ? "border-violet-600 text-violet-700"
                                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                            }`}
                        >
                            Drafts
                            {encodingCount > 0 && (
                                <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-violet-600">
                                    {encodingCount}
                                </Badge>
                            )}
                        </button>
                    )}
                    {isEncoder && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("returned")}
                            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === "returned"
                                    ? "border-orange-600 text-orange-700"
                                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                            }`}
                        >
                            Returned
                            {returnedCount > 0 && (
                                <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-orange-600">
                                    {returnedCount}
                                </Badge>
                            )}
                        </button>
                    )}
                    {!isEncoder && (
                    <button
                        type="button"
                        onClick={() => setActiveTab("overdue")}
                        className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                            activeTab === "overdue"
                                ? "border-red-600 text-red-700"
                                : "border-transparent text-zinc-500 hover:text-zinc-700"
                        }`}
                    >
                        Overdue Applications
                        {overdueCount > 0 && (
                            <Badge
                                variant="destructive"
                                className="h-5 min-w-5 px-1.5 text-[10px] font-bold"
                            >
                                {overdueCount}
                            </Badge>
                        )}
                    </button>
                    )}
                </div>

                {activeTab === "drafts" ? (
                    <DocumentsTable
                        user={user}
                        year={0}
                        search=""
                        status="encoding"
                        headerTitle="Draft Applications"
                        headerSubtitle="Applications awaiting submission"
                        onSubmitApplication={handleSubmitApplication}
                        onEditDocument={(documentId) => setEditDocumentId(documentId)}
                        onManageAttachments={(documentId) => setManageDocumentId(documentId)}
                        onInspectionReport={(documentId) => setInspectionReportDocumentId(documentId)}
                        onDeleteDocument={(documentId, documentTitle) => {
                            setDeleteDocumentId(documentId)
                            setDeleteDocumentTitle(documentTitle)
                        }}
                    />
                ) : activeTab === "returned" ? (
                    <DocumentsTable
                        user={user}
                        year={0}
                        search=""
                        status="returned"
                        headerTitle="Returned Applications"
                        headerSubtitle="Applications requiring corrections"
                        onSubmitApplication={handleSubmitApplication}
                        onEditDocument={(documentId) => setEditDocumentId(documentId)}
                        onManageAttachments={(documentId) => setManageDocumentId(documentId)}
                        onInspectionReport={(documentId) => setInspectionReportDocumentId(documentId)}
                        onDeleteDocument={(documentId, documentTitle) => {
                            setDeleteDocumentId(documentId)
                            setDeleteDocumentTitle(documentTitle)
                        }}
                    />
                ) : activeTab === "overdue" ? (
                    <OverdueApplicationsTable
                        user={user}
                        onEditDocument={(documentId) => setEditDocumentId(documentId)}
                        onManageAttachments={(documentId) => setManageDocumentId(documentId)}
                        onInspectionReport={(documentId) => setInspectionReportDocumentId(documentId)}
                        onDeleteDocument={(documentId, documentTitle) => {
                            setDeleteDocumentId(documentId)
                            setDeleteDocumentTitle(documentTitle)
                        }}
                    />
                ) : (
                <>
                {/* ── Section: Document / Months ── */}
                <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <h2 className="text-[13px] font-semibold text-zinc-700 uppercase tracking-wide shrink-0">
                            Document / Months
                        </h2>
                        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end">
                            <div className="relative flex-1 sm:max-w-md">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search title, app no., applicant, location..."
                                    className="pl-8 text-[13px] h-8 bg-white"
                                    value={docSearch}
                                    onChange={(e) => setDocSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <label className="text-[12px] text-zinc-500 font-medium">Year:</label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => {
                                        setSelectedYear(Number(e.target.value))
                                        setSelectedMonth(null)
                                    }}
                                    className="text-[12px] border border-zinc-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400 h-8"
                                >
                                    <option value={0}>All Years</option>
                                    {YEAR_OPTIONS.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Month cards grid */}
                    {isLoading ? (
                        <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <Skeleton key={i} className="h-[72px] rounded-md" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2">
                            {monthlyCounts.map((m) => {
                                const isSelected = selectedMonth?.month === m.month
                                return (
                                    <button
                                        key={m.month}
                                        onClick={() => handleCardClick(m)}
                                        className={`
                                            relative rounded-md border text-left px-3 py-2.5 transition-all
                                            ${isSelected
                                                ? "bg-green-600 border-green-600 text-white shadow-md"
                                                : "bg-white border-zinc-200 hover:border-green-400 hover:shadow-sm text-zinc-700"
                                            }
                                        `}
                                    >
                                        <p className={`text-[10px] font-semibold uppercase tracking-wide truncate ${isSelected ? "text-green-100" : "text-zinc-400"}`}>
                                            {m.month_name.slice(0, 3)}
                                        </p>
                                        <p className={`text-[22px] font-bold leading-tight mt-0.5 ${isSelected ? "text-white" : "text-zinc-800"}`}>
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.count}
                                        </p>
                                        <p className={`text-[9px] mt-0.5 ${isSelected ? "text-green-100" : "text-zinc-400"}`}>
                                            {m.count === 1 ? "document" : "documents"}
                                        </p>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Search results across selected year (or all years) */}
                    {debouncedDocSearch && (
                        <DocumentsTable
                            user={user}
                            year={selectedYear}
                            month={selectedMonth?.month}
                            monthName={selectedMonth?.month_name}
                            search={debouncedDocSearch}
                            headerTitle={
                                selectedMonth
                                    ? `${selectedMonth.month_name}${selectedYear > 0 ? ` ${selectedYear}` : ""}`
                                    : selectedYear > 0
                                      ? `All months · ${selectedYear}`
                                      : "All years"
                            }
                            headerSubtitle={`Matching "${debouncedDocSearch}"`}
                            onClose={() => setDocSearch("")}
                            onSubmitApplication={handleSubmitApplication}
                            onEditDocument={(documentId) => setEditDocumentId(documentId)}
                            onManageAttachments={(documentId) => setManageDocumentId(documentId)}
                            onInspectionReport={(documentId) => setInspectionReportDocumentId(documentId)}
                            onDeleteDocument={(documentId, documentTitle) => {
                                setDeleteDocumentId(documentId)
                                setDeleteDocumentTitle(documentTitle)
                            }}
                        />
                    )}

                    {/* Month documents table (when a month is selected and not searching) */}
                    {selectedMonth && !debouncedDocSearch && (
                        <DocumentsTable
                            user={user}
                            year={selectedYear}
                            month={selectedMonth.month}
                            monthName={selectedMonth.month_name}
                            search=""
                            headerTitle={`${selectedMonth.month_name} ${selectedYear > 0 ? selectedYear : ""}`.trim()}
                            onClose={() => setSelectedMonth(null)}
                            onSubmitApplication={handleSubmitApplication}
                            onEditDocument={(documentId) => setEditDocumentId(documentId)}
                            onManageAttachments={(documentId) => setManageDocumentId(documentId)}
                            onInspectionReport={(documentId) => setInspectionReportDocumentId(documentId)}
                            onDeleteDocument={(documentId, documentTitle) => {
                                setDeleteDocumentId(documentId)
                                setDeleteDocumentTitle(documentTitle)
                            }}
                        />
                    )}
                </div>

                {/* ── Section: Recent Files ── */}
                <div>
                    <h2 className="text-[13px] font-semibold text-zinc-700 uppercase tracking-wide mb-3">
                        Recent Files
                    </h2>
                    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[12px] font-semibold">Filename</TableHead>
                                    <TableHead className="text-[12px] font-semibold text-right">
                                        Date Uploaded
                                    </TableHead>
                                    <TableHead className="text-[12px] font-semibold text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading &&
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-36 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))}
                                {!isLoading && recentAttachments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                                            <FileText className="h-7 w-7 mx-auto mb-2 opacity-30" />
                                            <p className="text-[13px]">No recent files uploaded.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!isLoading &&
                                    recentAttachments.map((att) => (
                                        <TableRow key={att.id} className="hover:bg-zinc-50 text-[13px]">
                                            <TableCell className="text-green-700 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <FileText className={`h-4 w-4 shrink-0 ${att.file_name.toLowerCase().endsWith('.pdf') ? 'text-red-500' : 'text-zinc-400'}`} />
                                                    {att.file_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-zinc-500 whitespace-nowrap">
                                                {att.created_at
                                                    ? format(new Date(att.created_at), "MMMM d, yyyy h:mm a")
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                {canViewFiles && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-zinc-700 hover:bg-zinc-100"
                                                        onClick={() => setPreviewAttachment({ id: att.id, fileName: att.file_name })}
                                                        title="Preview"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                </>
                )}

            </div>

            {previewAttachment && (
                <PdfPreviewModal
                    open={!!previewAttachment}
                    onClose={() => setPreviewAttachment(null)}
                    attachmentId={previewAttachment.id}
                    fileName={previewAttachment.fileName}
                />
            )}

            <EditDocumentModal
                documentId={editDocumentId}
                open={editDocumentId !== null}
                onClose={() => setEditDocumentId(null)}
            />

            <ManageAttachmentsModal
                documentId={manageDocumentId}
                open={manageDocumentId !== null}
                onClose={() => setManageDocumentId(null)}
            />

            <DeleteDocumentConfirm
                documentId={deleteDocumentId}
                documentTitle={deleteDocumentTitle}
                open={deleteDocumentId !== null}
                onClose={() => {
                    setDeleteDocumentId(null)
                    setDeleteDocumentTitle("")
                }}
            />

            <InspectionReportModal
                documentId={inspectionReportDocumentId}
                open={inspectionReportDocumentId !== null}
                onClose={() => setInspectionReportDocumentId(null)}
            />

        </div>
    )
}
