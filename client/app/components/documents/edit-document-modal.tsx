import * as React from "react"
import { format } from "date-fns"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { useAuthStore } from "~/store/auth"
import {
    canEditDocument,
    isEncoderClerk,
} from "~/lib/permissions"
import { BuildingsLotsFields } from "~/components/documents/buildings-lots-fields"
import {
    appendBuildingsAndLotsToFormData,
    documentBuildingsToForm,
    documentLotsToForm,
    emptyBuildingEntry,
    emptyLotEntry,
} from "~/lib/document-property-utils"
import { displayZoningClassificationName } from "~/lib/zoning-utils"
import { getUploadPercent } from "~/lib/upload-utils"
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
    specificProjectType: z.string().min(1),
    applicantName: z.string().min(1),
    corporationName: z.string().optional(),
    corporationAddress: z.string().optional(),
    assistedBy: z.string().optional(),
    oic: z.string().optional(),
    barangay: z.string().min(1),
    purok: z.string().min(1),
    landmark: z.string().min(1),
    coordinates: z.string().optional(),
    buildings: z
        .array(
            z.object({
                name: z.string().min(1, { message: "Building name is required" }),
                area: z.string().min(1, { message: "Building area is required" }),
            }),
        )
        .min(1, { message: "At least one building is required" }),
    lots: z
        .array(
            z.object({
                landTitle: z.string().min(1, { message: "Land title / TCT number is required" }),
                area: z.string().min(1, { message: "Lot area is required" }),
            }),
        )
        .min(1, { message: "At least one lot is required" }),
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
    const { user } = useAuthStore()
    const isEncoder = isEncoderClerk(user)
    const [selectedZoningId, setSelectedZoningId] = React.useState<string>("")
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            documentTitle: "",
            zoning: "",
            zoningApplicationNo: "",
            typeOfProject: "",
            specificProjectType: "",
            applicantName: "",
            corporationName: "",
            corporationAddress: "",
            assistedBy: "",
            oic: "",
            barangay: "",
            purok: "",
            landmark: "",
            coordinates: "",
            buildings: [emptyBuildingEntry()],
            lots: [emptyLotEntry()],
            storey: "",
            mezanine: "",
            routedTo: [],
            files: [],
        },
    })

    const {
        fields: buildingFields,
        append: appendBuilding,
        remove: removeBuilding,
    } = useFieldArray({
        control: form.control,
        name: "buildings",
    })

    const {
        fields: lotFields,
        append: appendLot,
        remove: removeLot,
    } = useFieldArray({
        control: form.control,
        name: "lots",
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
            specificProjectType: document.specific_project_type_id ? document.specific_project_type_id.toString() : "N/A",
            applicantName: document.applicant_name,
            corporationName: document.corporation_name ?? "",
            corporationAddress: document.corporation_address ?? "",
            assistedBy: document.assisted_by ?? "",
            oic: document.oic,
            barangay: document.barangay_id.toString(),
            purok: document.purok_id.toString(),
            landmark: document.landmark,
            coordinates: document.coordinates ?? "",
            buildings: documentBuildingsToForm(document),
            lots: documentLotsToForm(document),
            storey: document.storey,
            mezanine: document.mezanine ?? "",
            routedTo: document.routed_to_users?.map((u) => u.id.toString()) ?? [],
            files: [],
        })
    }, [document, form])

    const selectedZoning = zonings?.find((zoning) => zoning.id.toString() === selectedZoningId)
    const selectedBarangay = barangays?.find((barangay) => barangay.id.toString() === form.watch("barangay"))
    const coordinatesLocked = document?.status !== "encoding"

    const updateMutation = useMutation({
        mutationFn: async ({
            values,
            mode,
        }: {
            values: z.infer<typeof formSchema>
            mode: "save" | "draft" | "submit"
        }) => {
            const formData = new FormData()
            formData.append("documentTitle", values.documentTitle)
            formData.append("zoning", values.zoning)
            formData.append("zoningApplicationNo", values.zoningApplicationNo)
            formData.append("typeOfProject", values.typeOfProject)
            formData.append("specificProjectType", values.specificProjectType)
            formData.append("applicantName", values.applicantName)
            formData.append("corporationName", values.corporationName ?? "")
            formData.append("corporationAddress", values.corporationAddress ?? "")
            if (values.assistedBy) {
                formData.append("assistedBy", values.assistedBy)
            }
            if (!isEncoder && values.oic) {
                formData.append("oic", values.oic)
            }
            formData.append("barangay", values.barangay)
            formData.append("purok", values.purok)
            formData.append("landmark", values.landmark)
            if (values.coordinates) {
                formData.append("coordinates", values.coordinates)
            }
            appendBuildingsAndLotsToFormData(formData, values.buildings, values.lots)
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

            if (mode === "draft") {
                formData.append("saveAsDraft", "1")
            } else if (mode === "submit") {
                formData.append("submitForProcessing", "1")
            }

            setUploadProgress(0)
            return DocumentService.updateDocument(documentId!, formData, (progressEvent) => {
                setUploadProgress(getUploadPercent(progressEvent))
            })
        },
        onSuccess: (_data, variables) => {
            setUploadProgress(0)
            toast.success(
                variables.mode === "draft"
                    ? "Application draft saved successfully"
                    : variables.mode === "submit"
                      ? "Application submitted successfully"
                      : "Document updated successfully"
            )
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] })
            queryClient.invalidateQueries({ queryKey: ["attachments"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            onClose()
        },
        onError: (error: any) => {
            setUploadProgress(0)
            toast.error(error?.response?.data?.message || "Failed to update document")
        },
    })

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        updateMutation.mutate({
            values,
            mode: isEncoder ? "submit" : "save",
        })
    }

    const handleSaveDraft = () => {
        updateMutation.mutate({
            values: form.getValues(),
            mode: "draft",
        })
    }

    const canEdit = canEditDocument(user, document?.status)

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

                {!isLoading && !canEdit && (
                    <p className="text-sm text-muted-foreground">
                        This application can no longer be edited in its current status.
                    </p>
                )}

                {!isLoading && canEdit && (
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
                                                form.setValue("specificProjectType", "")
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select zoning" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {zonings?.map((zoning) => (
                                                        <SelectItem key={zoning.id} value={zoning.id.toString()}>
                                                            {displayZoningClassificationName(zoning.name, zoning.name)}
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
                                            <Select
                                                onValueChange={(val) => {
                                                    field.onChange(val)
                                                    const pt = selectedZoning?.project_types?.find(p => p.id.toString() === val)
                                                    if (pt && pt.specific_project_types && pt.specific_project_types.length > 0) {
                                                        form.setValue("specificProjectType", "")
                                                    } else {
                                                        form.setValue("specificProjectType", "N/A")
                                                    }
                                                }}
                                                value={field.value}
                                            >
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
                                    name="specificProjectType"
                                    render={({ field }) => {
                                        const selectedProjectTypeId = form.watch("typeOfProject")
                                        const selectedProjectType = selectedZoning?.project_types?.find(p => p.id.toString() === selectedProjectTypeId)
                                        const specificProjectTypes = selectedProjectType?.specific_project_types ?? []

                                        return (
                                            <FormItem>
                                                <FormLabel>Specific Project Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectTypeId}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={!selectedProjectTypeId ? "Select Type of Project first" : specificProjectTypes.length === 0 ? "N/A" : "Select specific project type"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {specificProjectTypes.length === 0 ? (
                                                            <SelectItem value="N/A">N/A</SelectItem>
                                                        ) : (
                                                            specificProjectTypes.map((spt) => (
                                                                <SelectItem key={spt.id} value={spt.id.toString()}>
                                                                    {spt.name}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
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
                                    name="corporationName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name of Corporation</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="corporationAddress"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address of Corporation</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
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
                                {!isEncoder && (
                                <FormField
                                    control={form.control}
                                    name="oic"
                                    render={({ field }) => {
                                        const validUsers = users?.data?.filter(u => !u.roles.some((r: any) => r.name === 'Super Admin')) || []
                                        return (
                                            <FormItem>
                                                <FormLabel>OIC</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select OIC" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {validUsers.map(user => {
                                                            const fullName = `${user.first_name} ${user.last_name}`
                                                            return (
                                                                <SelectItem key={user.id} value={fullName}>
                                                                    {fullName}{user.designation ? ` — ${user.designation}` : ""}
                                                                </SelectItem>
                                                            )
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                )}
                                <FormItem>
                                    <FormLabel>Due Date</FormLabel>
                                    <FormControl>
                                        <Input
                                            readOnly
                                            disabled
                                            value={
                                                document?.due_date
                                                    ? format(new Date(document.due_date), "MMMM d, yyyy")
                                                    : "Not set"
                                            }
                                            className="bg-zinc-50 text-zinc-600"
                                        />
                                    </FormControl>
                                    <p className="text-[11px] text-muted-foreground">
                                        Due dates can only be extended via the &quot;Add Number of Days&quot; exception process.
                                    </p>
                                </FormItem>
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
                                            <FormLabel>Encoded Coordinates</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    readOnly={coordinatesLocked}
                                                    disabled={coordinatesLocked}
                                                    className={coordinatesLocked ? "bg-zinc-50" : undefined}
                                                />
                                            </FormControl>
                                            {coordinatesLocked && (
                                                <p className="text-[11px] text-muted-foreground">
                                                    Encoder coordinates are read-only after encoding. The inspector verifies or corrects them during inspection.
                                                </p>
                                            )}
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

                            <BuildingsLotsFields
                                control={form.control}
                                buildingFields={buildingFields}
                                appendBuilding={appendBuilding}
                                removeBuilding={removeBuilding}
                                lotFields={lotFields}
                                appendLot={appendLot}
                                removeLot={removeLot}
                            />

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
                                {isEncoder ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleSaveDraft}
                                            disabled={updateMutation.isPending}
                                        >
                                            {updateMutation.isPending
                                                ? uploadProgress > 0 && uploadProgress < 100
                                                    ? `Uploading... ${uploadProgress}%`
                                                    : "Saving..."
                                                : "Save Draft"}
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                            disabled={updateMutation.isPending}
                                        >
                                            {updateMutation.isPending
                                                ? uploadProgress > 0 && uploadProgress < 100
                                                    ? `Uploading... ${uploadProgress}%`
                                                    : "Submitting..."
                                                : "Submit for Processing"}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        disabled={updateMutation.isPending}
                                    >
                                        {updateMutation.isPending
                                            ? uploadProgress > 0 && uploadProgress < 100
                                                ? `Uploading... ${uploadProgress}%`
                                                : "Saving..."
                                            : "Save Changes"}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    )
}
