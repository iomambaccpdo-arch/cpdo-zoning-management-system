import * as React from "react"
import { Search, Plus, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DocumentService } from "~/api/DocumentService"
import { NewDocumentModal } from "~/components/documents/new-document-modal"
import { useAuthStore } from "~/store/auth"
import { FileCard, FileCardSkeleton } from "~/components/files/file-card"

export default function Files() {
    const { user } = useAuthStore()
    const canCreateFile = user?.roles?.some((role) =>
        role.permissions?.some((p: any) => p.resource === "Files" && p.name === "create")
    )

    const [search, setSearch] = React.useState("")
    const [debouncedSearch, setDebouncedSearch] = React.useState("")
    const [page, setPage] = React.useState(1)
    const queryClient = useQueryClient()

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const { data, isLoading } = useQuery({
        queryKey: ["attachments", debouncedSearch, page],
        queryFn: () =>
            DocumentService.getAttachments({ search: debouncedSearch, page, per_page: 16 }),
    })

    const attachments = data?.data ?? []
    const totalPages = data?.last_page ?? 1

    const handleDeleted = () => {
        queryClient.invalidateQueries({ queryKey: ["attachments"] })
        queryClient.invalidateQueries({ queryKey: ["documents"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 border-t border-zinc-200">
            <div className="px-5 py-3 border-b bg-white shrink-0">
                <h1 className="text-[16px] font-bold text-[#1a202c] tracking-tight uppercase leading-none mt-1">
                    Files Management
                </h1>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-auto">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by filename, title, applicant..."
                            className="pl-8 text-[13px] h-8"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                        />
                    </div>
                    {canCreateFile && (
                        <NewDocumentModal>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white font-medium h-8 text-[13px] px-3"
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" /> New Document
                            </Button>
                        </NewDocumentModal>
                    )}
                </div>

                {/* Loading skeletons */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <FileCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && attachments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-25" />
                        <p className="text-sm font-medium">No files found.</p>
                        <p className="text-xs mt-1">Uploaded files will appear here.</p>
                    </div>
                )}

                {/* File cards grid */}
                {!isLoading && attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {attachments.map((att) => (
                            <FileCard key={att.id} attachment={att} onDeleted={handleDeleted} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">
                            Page {data?.current_page} of {totalPages} ({data?.total} total)
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
