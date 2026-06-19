"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, UploadCloud, MapPin, CheckCircle2 } from "lucide-react"

import { useAuthStore } from "~/store/auth"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Calendar } from "~/components/ui/calendar"
import { Stepper } from "~/components/ui/stepper"
import { MultiSelect } from "~/components/ui/multi-select"
import { cn } from "~/lib/utils"
import { ZoningService } from "~/api/ZoningService"
import type { Zoning, ProjectType } from "~/api/ZoningService"
import { LocationService } from "~/api/LocationService"
import type { Barangay, Purok } from "~/api/LocationService"
import { AccountService } from "~/api/AccountService"
import { DocumentService } from "~/api/DocumentService"
import { SettingsService } from "~/api/SettingsService"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { calculateDueDate } from "~/lib/date-utils"
import { MapPickerModal } from "~/components/ui/map-picker/map-picker-modal"


const steps = [
    { title: "Document", description: "Basic Info" },
    { title: "Personnel", description: "Applicant Details" },
    { title: "Location", description: "Site Details" },
    { title: "Property", description: "Measurements" },
    { title: "Attachments", description: "Upload Files" },
]

const formSchema = z.object({
    // Step 1
    documentTitle: z.string().min(1, { message: "Document Title is required" }),
    zoning: z.string().min(1, { message: "Zoning is required" }),
    zoningApplicationNo: z.string().min(1, { message: "Application No is required" }),
    typeOfProject: z.string().min(1, { message: "Type of Project is required" }),
    specificProjectType: z.string().min(1, { message: "Specific Project Type is required" }),
    dateOfApplication: z.date({ message: "A date of application is required." }),
    dueDate: z.string().optional(),

    // Step 2
    applicantName: z.string().min(1, { message: "Applicant Name is required" }),
    receivedBy: z.string().min(1, { message: "Received By is required" }),
    assistedBy: z.string().optional(),
    routedTo: z.array(z.string()).min(1, { message: "Routed to is required" }),

    // Step 3
    barangay: z.string().min(1, { message: "Barangay is required" }),
    purok: z.string().min(1, { message: "Purok is required" }),
    landmark: z.string().min(1, { message: "Landmark is required" }),
    coordinates: z.string().min(1, { message: "Coordinates are required" }),

    // Step 4
    floorArea: z.string().min(1, { message: "Floor Area is required" }),
    lotArea: z.string().min(1, { message: "Lot Area is required" }),
    storey: z.string().min(1, { message: "Storey is required" }),
    mezanine: z.string().optional(),

    // Step 5
    files: z
        .array(z.instanceof(File))
        .min(1, { message: "At least one PDF file is required" }),
})

interface NewDocumentModalProps {
    children?: React.ReactNode
}

function formatUserFullName(user: {
    first_name: string
    middle_name?: string | null
    last_name: string
}) {
    return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ")
}

export function NewDocumentModal({ children }: NewDocumentModalProps) {
    const [open, setOpen] = React.useState(false)
    const [activeStep, setActiveStep] = React.useState(0)
    const [isMapModalOpen, setIsMapModalOpen] = React.useState(false)
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const queryClient = useQueryClient()
    const authUser = useAuthStore((state) => state.user)
    const receivedByLabel = authUser ? formatUserFullName(authUser) : "Your account"

    const { data: zonings } = useQuery({
        queryKey: ['zonings'],
        queryFn: ZoningService.getZonings,
    })

    const { data: barangays } = useQuery({
        queryKey: ['barangays'],
        queryFn: LocationService.getBarangays,
    })

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => AccountService.getUsers({ per_page: 100 }),
    })

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: SettingsService.getSettings,
    })

    const numberOfDays = settings?.number_of_days ?? 12

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            documentTitle: "",
            zoning: "",
            zoningApplicationNo: "",
            typeOfProject: "",
            specificProjectType: "",
            dateOfApplication: new Date(),
            applicantName: "",
            receivedBy: "Auto-assigned by System",
            assistedBy: "",
            routedTo: [],
            barangay: "",
            purok: "",
            landmark: "",
            coordinates: "",
            floorArea: "",
            lotArea: "",
            storey: "",
            mezanine: "",
            dueDate: "", // Auto-calculated
            files: [],
        },
    })

    // Calculate due date automatically from configured working days
    const dateOfApplication = form.watch("dateOfApplication")
    React.useEffect(() => {
        if (dateOfApplication) {
            const dueDate = calculateDueDate(dateOfApplication, numberOfDays)
            form.setValue("dueDate", format(dueDate, "MMMM d, yyyy"))
        } else {
            form.setValue("dueDate", "")
        }
    }, [dateOfApplication, numberOfDays, form])

    // Generate Application No. on document title change
    const documentTitle = form.watch("documentTitle");
    React.useEffect(() => {
        const fetchApplicationNo = async () => {
            if (documentTitle) {
                try {
                    const data = await DocumentService.getNextApplicationNo(documentTitle);
                    form.setValue("zoningApplicationNo", data.applicationNo);
                } catch (error) {
                    console.error("Failed to fetch next application number", error);
                }
            }
        };
        fetchApplicationNo();
    }, [documentTitle, form]);

    const nextStep = async () => {
        let fieldsToValidate: any[] = []

        if (activeStep === 0) {
            fieldsToValidate = ['documentTitle', 'zoning', 'zoningApplicationNo', 'typeOfProject', 'specificProjectType', 'dateOfApplication']
        } else if (activeStep === 1) {
            fieldsToValidate = ['applicantName', 'receivedBy', 'routedTo']
        } else if (activeStep === 2) {
            fieldsToValidate = ['barangay', 'purok', 'landmark', 'coordinates']
        } else if (activeStep === 3) {
            fieldsToValidate = ['floorArea', 'lotArea', 'storey']
        } else if (activeStep === 4) {
            fieldsToValidate = ['files']
        }

        const isValid = await form.trigger(fieldsToValidate)
        if (isValid) {
            setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
        }
    }

    const prevStep = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0))
    }

    const { mutate: createDocument, isPending } = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const formData = new FormData()

            // Append standard text/date fields
            formData.append('documentTitle', values.documentTitle)
            formData.append('zoning', values.zoning)
            formData.append('zoningApplicationNo', values.zoningApplicationNo)
            formData.append('typeOfProject', values.typeOfProject)
            formData.append('specificProjectType', values.specificProjectType)
            formData.append('dateOfApplication', values.dateOfApplication.toISOString())
            if (values.dueDate) formData.append('dueDate', values.dueDate)

            formData.append('applicantName', values.applicantName)
            formData.append('receivedBy', values.receivedBy)
            if (values.assistedBy) formData.append('assistedBy', values.assistedBy)

            formData.append('barangay', values.barangay)
            formData.append('purok', values.purok)
            formData.append('landmark', values.landmark)
            if (values.coordinates) formData.append('coordinates', values.coordinates)

            formData.append('floorArea', values.floorArea)
            formData.append('lotArea', values.lotArea)
            formData.append('storey', values.storey)
            if (values.mezanine) formData.append('mezanine', values.mezanine)

            // Append arrays
            values.routedTo.forEach((userId) => {
                formData.append('routedTo[]', userId)
            })

            // Append files
            if (values.files && values.files.length > 0) {
                values.files.forEach((file: File) => {
                    formData.append('files[]', file)
                })
            }

            return await DocumentService.createDocument(formData, (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    setUploadProgress(percentCompleted)
                }
            })
        },
        onSuccess: () => {
            setOpen(false)
            setUploadProgress(0)
            form.reset()
            setActiveStep(0)
            queryClient.invalidateQueries({ queryKey: ['documents'] })
            queryClient.invalidateQueries({ queryKey: ['attachments'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            toast.success("Document created successfully")
        },
        onError: (error: any) => {
            console.error("Failed to submit document:", error)
            toast.error(error?.response?.data?.message || "Failed to create document")
        }
    })

    function onSubmit(values: z.infer<typeof formSchema>) {
        createDocument(values)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] w-[95vw] sm:w-full max-h-[90dvh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle>New Document</DialogTitle>
                        <DialogDescription>
                            Fill out the form below to register a new document in the CPDO Zoning System.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="h-auto min-h-[7rem] shrink-0 py-2 pb-4 border-b px-6 bg-background w-full">
                    <Stepper activeStep={activeStep} steps={steps} />
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar min-h-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* STEP 1: Document Information */}
                            <div className={cn("flex flex-col gap-6", activeStep === 0 ? "flex" : "hidden")}>
                                <FormField
                                    control={form.control}
                                    name="documentTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Document Title *</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select Document Title" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="LC Area">LC Area</SelectItem>
                                                    <SelectItem value="LC Building">LC Building</SelectItem>
                                                    <SelectItem value="LC Subdivision">LC Subdivision</SelectItem>
                                                    <SelectItem value="LC LZBA Area">LC LZBA Area</SelectItem>
                                                    <SelectItem value="LC LZBA Building">LC LZBA Building</SelectItem>
                                                    <SelectItem value="LC LZBA Subdivision">LC LZBA Subdivision</SelectItem>
                                                    <SelectItem value="Zoning Clearance">Zoning Clearance</SelectItem>
                                                    <SelectItem value="Development Permit">Development Permit</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="zoning"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zoning *</FormLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    form.setValue("typeOfProject", ""); // Reset dependent field
                                                    form.setValue("specificProjectType", ""); // Reset dependent field
                                                }}
                                                defaultValue={field.value}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select Zoning" />
                                                    </SelectTrigger>
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
                                    name="zoningApplicationNo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zoning Application No. *</FormLabel>
                                            <FormControl>
                                                <Input readOnly placeholder="Enter application number" className="bg-blue-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dateOfApplication"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date of Application *</FormLabel>
                                            <FormControl>
                                                <Input readOnly value={field.value ? format(field.value, "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy")} className="bg-blue-50/50 font-medium" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="typeOfProject"
                                    render={({ field }) => {
                                        const selectedZoningId = form.watch("zoning");
                                        const selectedZoning = zonings?.find(z => z.id.toString() === selectedZoningId);
                                        const projectTypes = selectedZoning?.project_types || [];

                                        return (
                                            <FormItem>
                                                <FormLabel>Type of Project *</FormLabel>
                                                <Select
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        const pt = projectTypes.find(p => p.id.toString() === val);
                                                        if (pt && pt.specific_project_types && pt.specific_project_types.length > 0) {
                                                            form.setValue("specificProjectType", "");
                                                        } else {
                                                            form.setValue("specificProjectType", "N/A");
                                                        }
                                                    }}
                                                    defaultValue={field.value}
                                                    value={field.value}
                                                    disabled={!selectedZoningId || projectTypes.length === 0}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full bg-gray-50/50">
                                                            <SelectValue placeholder={!selectedZoningId ? "Select Zoning first" : projectTypes.length === 0 ? "No projects for this zoning" : "Select Type of Project"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {projectTypes.map((pt) => (
                                                            <SelectItem key={pt.id} value={pt.id.toString()}>
                                                                {pt.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="specificProjectType"
                                    render={({ field }) => {
                                        const selectedZoningId = form.watch("zoning");
                                        const selectedZoning = zonings?.find(z => z.id.toString() === selectedZoningId);
                                        const projectTypes = selectedZoning?.project_types || [];
                                        const selectedProjectTypeId = form.watch("typeOfProject");
                                        const selectedProjectType = projectTypes.find(p => p.id.toString() === selectedProjectTypeId);
                                        const specificProjectTypes = selectedProjectType?.specific_project_types || [];

                                        return (
                                            <FormItem>
                                                <FormLabel>Specific Project Type *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    value={field.value}
                                                    disabled={!selectedProjectTypeId}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full bg-gray-50/50">
                                                            <SelectValue placeholder={!selectedProjectTypeId ? "Select Type of Project first" : specificProjectTypes.length === 0 ? "N/A" : "Select Specific Project Type"} />
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
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="dueDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Due Date (Auto {numberOfDays} Working Day{numberOfDays === 1 ? "" : "s"} excl. PH Holidays) *
                                            </FormLabel>
                                            <FormControl>
                                                <Input readOnly className="bg-blue-50/50 font-medium" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 2: Personnel & Applicant */}
                            <div className={cn("flex flex-col gap-6", activeStep === 1 ? "flex" : "hidden")}>
                                <FormField
                                    control={form.control}
                                    name="applicantName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name of Applicant *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter applicant name" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="receivedBy"
                                    render={() => (
                                        <FormItem>
                                            <FormLabel>Received By *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    readOnly
                                                    className="bg-gray-50/50"
                                                    value={receivedByLabel}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Linked to your account and updates when your profile changes.
                                            </FormDescription>
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
                                            <FormControl>
                                                <Input placeholder="Assisted by" className="bg-gray-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="routedTo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Routed to *</FormLabel>
                                            <FormControl>
                                                <MultiSelect
                                                    options={users?.data?.map(u => ({ label: u.email, value: u.id.toString() })) || []}
                                                    selected={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Search by name or email..."
                                                    className=" bg-gray-50/50"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 3: Location Details */}
                            <div className={cn("flex flex-col gap-6", activeStep === 2 ? "flex" : "hidden")}>
                                <FormField
                                    control={form.control}
                                    name="barangay"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Barangay *</FormLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    form.setValue("purok", ""); // Reset dependent field
                                                }}
                                                defaultValue={field.value}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="w-full bg-gray-50/50">
                                                        <SelectValue placeholder="Select Barangay" />
                                                    </SelectTrigger>
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
                                    render={({ field }) => {
                                        const selectedBarangayId = form.watch("barangay");
                                        const selectedBarangay = barangays?.find(b => b.id.toString() === selectedBarangayId);
                                        const puroks = selectedBarangay?.puroks || [];

                                        return (
                                            <FormItem>
                                                <FormLabel>Purok *</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedBarangayId || puroks.length === 0}>
                                                    <FormControl>
                                                        <SelectTrigger className="w-full bg-gray-50/50">
                                                            <SelectValue placeholder={!selectedBarangayId ? "Select Barangay first" : puroks.length === 0 ? "No puroks for this barangay" : "Select Purok"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {puroks.map((purok) => (
                                                            <SelectItem key={purok.id} value={purok.id.toString()}>
                                                                {purok.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="landmark"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Landmark *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter landmark" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="coordinates"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Geographic Coordinates *</FormLabel>
                                            <div className="flex gap-2">
                                                <FormControl>
                                                    <Input placeholder="Click pin to pick coordinates" className="bg-blue-50/50 flex-1" {...field} />
                                                </FormControl>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                                                    onClick={() => setIsMapModalOpen(true)}
                                                >
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 4: Property Details */}
                            <div className={cn("flex flex-col gap-6", activeStep === 3 ? "flex" : "hidden")}>
                                <FormField
                                    control={form.control}
                                    name="floorArea"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Floor Area (square meter) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="lotArea"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lot Area (square meter) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="storey"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Storey (Number of Floors) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="mezanine"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mezanine *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter mezanine details" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 5: Attachments */}
                            <div className={cn("flex flex-col gap-6", activeStep === 4 ? "flex" : "hidden")}>
                                <FormField
                                    control={form.control}
                                    name="files"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="sr-only">Upload Files</FormLabel>
                                            <FormControl>
                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        accept=".pdf,application/pdf"
                                                        onChange={(event) => {
                                                            const selectedFiles = Array.from(event.target.files ?? [])
                                                                .filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))

                                                            if (event.target.files && event.target.files.length > 0 && selectedFiles.length === 0) {
                                                                toast.error("Please upload PDF files only")
                                                            }

                                                            field.onChange(selectedFiles)
                                                        }}
                                                    />
                                                    <UploadCloud className="h-10 w-10 text-gray-400 mb-4" />
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Button type="button" className="bg-green-600 hover:bg-green-700 text-white pointer-events-none">
                                                            <UploadCloud className="mr-2 h-4 w-4" />
                                                            Upload PDF Files
                                                        </Button>
                                                        <span className="text-sm text-gray-500">
                                                            {field.value && field.value.length > 0
                                                                ? `${field.value.length} file(s) attached.`
                                                                : "No file attached. Upload one or more PDF files."}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-2">
                                                        Supported files: PDF only (up to 64 MB each; restart the API with start-cpdo-system.bat if upload fails)
                                                    </p>

                                                    {field.value && field.value.length > 0 && (
                                                        <div className="mt-4 w-full flex flex-col gap-2 max-h-32 overflow-y-auto">
                                                            {field.value.map((f: File, i: number) => (
                                                                <div key={i} className="text-sm bg-white p-2 rounded border flex justify-between items-center z-10">
                                                                    <span className="truncate max-w-[200px]">{f.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="bg-blue-50/50 p-4 rounded-lg flex items-start gap-3 mt-6">
                                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-sm text-blue-900">Review your submission</h4>
                                        <p className="text-sm text-blue-700 mt-1">
                                            Please ensure all information provided across the steps is accurate before submitting the application.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 border-t mt-auto flex sm:justify-between items-center w-full flex-row">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={activeStep === 0}
                    >
                        Previous
                    </Button>

                    {activeStep < steps.length - 1 ? (
                        <Button type="button" onClick={nextStep} className="bg-green-600 hover:bg-green-700 text-white">
                            Next Step
                        </Button>
                    ) : (
                        <Button
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={isPending}
                            className="bg-green-600 hover:bg-green-700 text-white md:min-w-[150px]"
                        >
                            {isPending ? (uploadProgress > 0 && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : "Submitting...") : "Submit Document"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>

            {/* Map Picker Modal */}
            <MapPickerModal
                open={isMapModalOpen}
                onClose={() => setIsMapModalOpen(false)}
                onConfirm={(coords) => {
                    form.setValue("coordinates", coords)
                    form.trigger("coordinates")
                }}
                initialCoordinates={form.getValues("coordinates")}
            />
        </Dialog>
    )
}
