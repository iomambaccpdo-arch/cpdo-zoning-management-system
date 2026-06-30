import { format } from "date-fns"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import type { DueDateExtension } from "~/api/DocumentService"

interface DueDateExtensionHistoryProps {
    extensions: DueDateExtension[]
}

export function DueDateExtensionHistory({ extensions }: DueDateExtensionHistoryProps) {
    if (!extensions || extensions.length === 0) {
        return (
            <p className="text-[12px] text-muted-foreground italic py-2">
                No due date extensions recorded for this document.
            </p>
        )
    }

    return (
        <div className="border rounded-md overflow-auto max-h-[200px]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-[11px] font-semibold">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold">Extended By</TableHead>
                        <TableHead className="text-[11px] font-semibold">Days Added</TableHead>
                        <TableHead className="text-[11px] font-semibold">Previous</TableHead>
                        <TableHead className="text-[11px] font-semibold">New Due Date</TableHead>
                        <TableHead className="text-[11px] font-semibold">Reason</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {extensions.map((ext) => (
                        <TableRow key={ext.id} className="text-[12px]">
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                {ext.created_at
                                    ? format(new Date(ext.created_at), "MMM d, yyyy h:mm a")
                                    : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {typeof ext.extended_by === "object" && ext.extended_by
                                    ? `${ext.extended_by.first_name} ${ext.extended_by.last_name}`
                                    : "—"}
                            </TableCell>
                            <TableCell className="font-medium text-blue-700">
                                +{ext.days_added}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {format(new Date(ext.previous_due_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                                {format(new Date(ext.new_due_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={ext.reason ?? undefined}>
                                {ext.reason ?? "—"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
