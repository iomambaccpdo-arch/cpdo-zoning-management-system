import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { DocumentService } from "~/api/DocumentService"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"

const formSchema = z.object({
    daysToAdd: z.number().min(1, "Must add at least 1 day").max(365, "Cannot add more than 365 days"),
    reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
})

interface ExtendDueDateModalProps {
    documentId: number | null
    documentTitle: string
    currentDueDate: string | null
    open: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function ExtendDueDateModal({ documentId, documentTitle, currentDueDate, open, onClose, onSuccess }: ExtendDueDateModalProps) {
    const queryClient = useQueryClient()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            daysToAdd: 0,
            reason: "",
        },
    })

    React.useEffect(() => {
        if (open) {
            form.reset({ daysToAdd: 0, reason: "" })
        }
    }, [open, form])

    const extendMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            return DocumentService.extendDueDate(documentId!, values.daysToAdd, values.reason)
        },
        onSuccess: () => {
            toast.success("Due date extended successfully")
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            queryClient.invalidateQueries({ queryKey: ["attachments"] })
            onSuccess?.()
            form.reset()
            onClose()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to extend due date")
        },
    })

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        extendMutation.mutate(values)
    }

    const daysToAdd = form.watch("daysToAdd")
    const newDueDate = React.useMemo(() => {
        if (!currentDueDate || !daysToAdd || daysToAdd === 0) return null
        const date = new Date(currentDueDate)
        date.setDate(date.getDate() + daysToAdd)
        return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    }, [currentDueDate, daysToAdd])

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Number of Days</DialogTitle>
                    <DialogDescription>
                        Extend the due date for this document when unforeseen events occur (e.g., natural disasters, power outages). Only affects: <span className="font-semibold">{documentTitle}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <div className="text-sm">
                        <span className="font-medium text-blue-900">Current Due Date:</span>{" "}
                        <span className="text-blue-800">
                            {currentDueDate ? new Date(currentDueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                        </span>
                    </div>
                    {newDueDate && (
                        <div className="text-sm mt-1">
                            <span className="font-medium text-blue-900">New Due Date:</span>{" "}
                            <span className="text-blue-800 font-semibold">{newDueDate}</span>
                        </div>
                    )}
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="daysToAdd"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number of Days to Add</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="365"
                                            placeholder="Enter number of days (1-365)"
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Extension</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Provide a reason for extending the due date (e.g., earthquake, power outage, natural disaster, etc.)"
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={extendMutation.isPending}
                            >
                                {extendMutation.isPending ? "Adding..." : "Add Number of Days"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
