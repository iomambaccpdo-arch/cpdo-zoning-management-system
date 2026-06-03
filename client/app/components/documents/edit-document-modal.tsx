import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { AccountService } from "~/api/AccountService"
import { DocumentService } from "~/api/DocumentService"
import { LocationService } from "~/api/LocationService"
import { ZoningService } from "~/api/ZoningService"
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
import { MultiSelect } from "~/components/ui/multi-select"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"

const formSchema = z.object({
    documentTitle: z.string().min(1),
    zoning: z.string().min(1),
    zoningApplicationNo: z.string().min(1),
    typeOfProject: z.string().min(1),
    dueDate: z.string().optional(),
    applicantName: z.string().min(1),
    assistedBy: z.string().optional(),
    oic: z.string().min(1),
    barangay: z.string().min(1),
    purok: z.string().min(1),
    landmark: z.string().min(1),
    coordinates: z.string().optional(),
    floorArea: z.string().min(1),
    lotArea: z.string().min(1),
    storey: z.string().min(1),
    mezanine: z.string().optional(),
    routedTo: z.array(z.string()).min(1),
    files: z.instanceof(File).array().optional(),
})

interface EditDocumentModalProps {
    documentId: number | null
    open: boolean
    onClose: () => void
}

export function EditDocumentModal({ documentId, open, onClose }: EditDocumentModalProps) {
    const queryClient = useQueryClient()
    const [selectedZoningId, setSelectedZoningId] = React.useState<string>("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            documentTitle: "",
            zoning: "",
            zoningApplicationNo: "",
            typeOfProject: "",
            dueDate: "",
            applicantName: "",
            assistedBy: "",
            oic: "",
            barangay: "",
            purok: "",
            landmark: "",
            coordinates: "",
            floorArea: "",
            lotArea: "",
            storey: "",
            mezanine: "",
            routedTo: [],
            files: [],
        },
    })

    const { data: document, isLoading } = useQuery({
        queryKey: ["document", documentId],
        queryFn: () => DocumentService.getDocument(documentId!),
        enabled: open && !!documentId,
    })

    const { data: zonings } = useQuery({
        queryKey: ["zonings"],
        queryFn: ZoningService.getZonings,
        enabled: open,
    })

    const { data: barangays } = useQuery({
        queryKey: ["barangays"],
        queryFn: LocationService.getBarangays,
        enabled: open,
    })

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: () => AccountService.getUsers({ per_page: 100 }),
        enabled: open,
    })

    React.useEffect(() => {
        if (!document) {
            return
        }

        setSelectedZoningId(document.zoning_id.toString())
        form.reset({
            documentTitle: document.document_title,
            zoning: document.zoning_id.toString(),
            zoningApplicationNo: document.zoning_application_no,
            typeOfProject: document.project_type_id.toString(),
            dueDate: document.due_date ?? "",
            applicantName: document.applicant_name,
            assistedBy: document.assisted_by ?? "",
            oic: document.oic,
            barangay: document.barangay_id.toString(),
            purok: document.purok_id.toString(),
            landmark: document.landmark,
            coordinates: document.coordinates ?? "",
            floorArea: document.floor_area,
            lotArea: document.lot_area,
            storey: document.storey,
            mezanine: document.mezanine ?? "",
            routedTo: document.routed_to_users?.map((u) => u.id.toString()) ?? [],
            files: [],
        })
    }, [document, form])

    const selectedZoning = zonings?.find((zoning) => zoning.id.toString() === selectedZoningId)
    const selectedBarangay = barangays?.find((barangay) => barangay.id.toString() === form.watch("barangay"))

    const updateMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const formData = new FormData()
            formData.append("documentTitle", values.documentTitle)
            formData.append("zoning", values.zoning)
            formData.append("zoningApplicationNo", values.zoningApplicationNo)
            formData.append("typeOfProject", values.typeOfProject)
            if (values.dueDate) {
                formData.append("dueDate", values.dueDate)
            }
            formData.append("applicantName", values.applicantName)
            if (values.assistedBy) {
                formData.append("assistedBy", values.assistedBy)
            }
            formData.append("oic", values.oic)
            formData.append("barangay", values.barangay)
            formData.append("purok", values.purok)
            formData.append("landmark", values.landmark)
            if (values.coordinates) {
                formData.append("coordinates", values.coordinates)
            }
            formData.append("floorArea", values.floorArea)
            formData.append("lotArea", values.lotArea)
            formData.append("storey", values.storey)
            if (values.mezanine) {
                formData.append("mezanine", values.mezanine)
            }

            values.routedTo.forEach((userId) => {
                formData.append("routedTo[]", userId)
            })

            values.files?.forEach((file) => {
                formData.append("files[]", file)
            })

            return DocumentService.updateDocument(documentId!, formData)
        },
        onSuccess: () => {
            toast.success("Document updated successfully")
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] })
            queryClient.invalidateQueries({ queryKey: ["attachments"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            onClose()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to update document")
        },
    })

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        updateMutation.mutate(values)
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[960px] w-[96vw] max-h-[92dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Document</DialogTitle>
                    <DialogDescription>
                        Update document metadata and optionally attach more PDF files.
                    </DialogDescription>
                </DialogHeader>

                {isLoading && <p className="text-sm text-muted-foreground">Loading document...</p>}

                {!isLoading && (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="documentTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Document Title</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="zoningApplicationNo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Application No.</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="zoning"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zoning</FormLabel>
                                            <Select onValueChange={(value) => {
                                                field.onChange(value)
                                                setSelectedZoningId(value)
                                                form.setValue("typeOfProject", "")
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select zoning" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {zonings?.map((zoning) => (
                                                        <SelectItem key={zoning.id} value={zoning.id.toString()}>
                                                            {zoning.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="typeOfProject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type of Project</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select project type" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {selectedZoning?.project_types?.map((projectType) => (
                                                        <SelectItem key={projectType.id} value={projectType.id.toString()}>
                                                            {projectType.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicantName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Applicant Name</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="assistedBy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Assisted By</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="oic"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>OIC</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dueDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Due Date</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="barangay"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Barangay</FormLabel>
                                            <Select onValueChange={(value) => {
                                                field.onChange(value)
                                                form.setValue("purok", "")
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select barangay" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {barangays?.map((barangay) => (
                                                        <SelectItem key={barangay.id} value={barangay.id.toString()}>
                                                            {barangay.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="purok"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Purok</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select purok" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {selectedBarangay?.puroks?.map((purok) => (
                                                        <SelectItem key={purok.id} value={purok.id.toString()}>
                                                            {purok.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="landmark"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Landmark</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="coordinates"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Coordinates</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="floorArea"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Floor Area</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="lotArea"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lot Area</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="storey"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Storey</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="mezanine"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mezanine</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="routedTo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Routed To</FormLabel>
                                        <FormControl>
                                            <MultiSelect
                                                options={users?.data?.map((u) => ({
                                                    label: `${u.first_name} ${u.last_name} (${u.email})`,
                                                    value: u.id.toString(),
                                                })) ?? []}
                                                selected={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select routed users"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="files"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Add More PDF Attachments (Optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="file"
                                                multiple
                                                accept=".pdf,application/pdf"
                                                onChange={(event) => {
                                                    const files = Array.from(event.target.files ?? [])
                                                    field.onChange(files)
                                                }}
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
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    )
}
