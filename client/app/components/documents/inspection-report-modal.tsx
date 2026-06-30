import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ClipboardCheck, Loader2, MapPin, Printer } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import {
    DocumentService,
    type InspectionReport,
} from "~/api/DocumentService"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { MapPickerModal } from "~/components/ui/map-picker/map-picker-modal"
import { printInspectionReport } from "~/components/documents/inspection-report-print"
import {
    buildInspectionReportPrefill,
    DEFAULT_LEGAL_BASES,
    DEFAULT_PARKING_BUILDING_CODE,
} from "~/lib/inspection-report-utils"
import { useAuthStore } from "~/store/auth"

const draftSchema = z.object({
    dateOfReport: z.string().optional(),
    projectLifeSpan: z.string().max(255).optional(),
    projectSignificance: z.string().max(255).optional(),
    rightOverLand: z.string().max(255).optional(),
    areaDetails: z.string().max(10000).optional(),
    locationDetails: z.string().max(5000).optional(),
    inspectionDate: z.string().optional(),
    projectStatusAsOfInspection: z.string().max(255).optional(),
    gpsCoordinates: z.string().max(255).optional(),
    informationProvidedInOrder: z.string().max(10).optional(),
    informationProvidedFindings: z.string().max(5000).optional(),
    abuttingNorth: z.string().max(255).optional(),
    abuttingSouth: z.string().max(255).optional(),
    abuttingEast: z.string().max(255).optional(),
    abuttingWest: z.string().max(255).optional(),
    legalBases: z.string().max(255).optional(),
    findingsEvaluation: z.string().max(10000).optional(),
    roadCategory: z.string().max(255).optional(),
    roadStandardRrow: z.string().max(255).optional(),
    roadActualRrow: z.string().max(255).optional(),
    roadMinSetback: z.string().max(255).optional(),
    roadAsPerPlan: z.string().max(255).optional(),
    roadRemarks: z.string().max(5000).optional(),
    parkingBuildingCode: z.string().max(255).optional(),
    parkingSpaceRequirement: z.string().max(5000).optional(),
    parkingRemarks: z.string().max(5000).optional(),
    typeOfLot: z.string().max(255).optional(),
    frontSetback: z.string().max(255).optional(),
    distanceCenterLineToBuilding: z.string().max(255).optional(),
    decisionRecommended: z.string().max(5000).optional(),
    inspectorSignature: z.string().max(255).optional(),
    inspectorDesignation: z.string().max(255).optional(),
    notedBySignature: z.string().max(255).optional(),
    notedByDesignation: z.string().max(255).optional(),
})

const submitSchema = z.object({
    dateOfReport: z.string().min(1, "Date of report is required"),
    projectLifeSpan: z.string().min(1, "Project life span is required"),
    projectSignificance: z.string().min(1, "Project significance is required"),
    rightOverLand: z.string().min(1, "Right over land is required"),
    areaDetails: z.string().max(10000).optional(),
    locationDetails: z.string().max(5000).optional(),
    inspectionDate: z.string().min(1, "Date of inspection is required"),
    projectStatusAsOfInspection: z.string().min(1, "Project status is required"),
    gpsCoordinates: z.string().min(1, "GPS coordinates are required"),
    informationProvidedInOrder: z.string().max(10).optional(),
    informationProvidedFindings: z.string().max(5000).optional(),
    abuttingNorth: z.string().max(255).optional(),
    abuttingSouth: z.string().max(255).optional(),
    abuttingEast: z.string().max(255).optional(),
    abuttingWest: z.string().max(255).optional(),
    legalBases: z.string().max(255).optional(),
    findingsEvaluation: z.string().min(1, "Findings / evaluation is required"),
    roadCategory: z.string().max(255).optional(),
    roadStandardRrow: z.string().max(255).optional(),
    roadActualRrow: z.string().max(255).optional(),
    roadMinSetback: z.string().max(255).optional(),
    roadAsPerPlan: z.string().max(255).optional(),
    roadRemarks: z.string().max(5000).optional(),
    parkingBuildingCode: z.string().max(255).optional(),
    parkingSpaceRequirement: z.string().max(5000).optional(),
    parkingRemarks: z.string().max(5000).optional(),
    typeOfLot: z.string().max(255).optional(),
    frontSetback: z.string().max(255).optional(),
    distanceCenterLineToBuilding: z.string().max(255).optional(),
    decisionRecommended: z.string().min(1, "Decision recommended is required"),
    inspectorSignature: z.string().min(1, "Inspector signature is required"),
    inspectorDesignation: z.string().max(255).optional(),
    notedBySignature: z.string().max(255).optional(),
    notedByDesignation: z.string().max(255).optional(),
})

type FormValues = z.infer<typeof draftSchema>

interface InspectionReportModalProps {
    documentId: number | null
    open: boolean
    onClose: () => void
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
            <p className="text-[13px] text-zinc-800 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 min-h-[38px] whitespace-pre-wrap">
                {value || "—"}
            </p>
        </div>
    )
}

function reportToFormValues(report: InspectionReport): FormValues {
    const legacyReport = report as InspectionReport & {
        existing_land_uses_abutting?: string | null
        road_category_info?: string | null
        setback_requirements?: string | null
        parking_space_requirements?: string | null
        remarks?: string | null
    }

    let findings = report.findings_evaluation ?? ""
    if (!findings && legacyReport.setback_requirements) {
        findings = legacyReport.setback_requirements
    }

    let decision = report.decision_recommended ?? ""
    if (!decision && legacyReport.remarks) {
        decision = legacyReport.remarks
    }

    return {
        dateOfReport: report.date_of_report ?? "",
        projectLifeSpan: report.project_life_span ?? "",
        projectSignificance: report.project_significance ?? "",
        rightOverLand: report.right_over_land ?? "",
        areaDetails: report.area_details ?? "",
        locationDetails: report.location_details ?? "",
        inspectionDate: report.inspection_date ?? "",
        projectStatusAsOfInspection: report.project_status_as_of_inspection ?? "",
        gpsCoordinates: report.gps_coordinates ?? "",
        informationProvidedInOrder: report.information_provided_in_order ?? "",
        informationProvidedFindings: report.information_provided_findings ?? "",
        abuttingNorth: report.abutting_north ?? "",
        abuttingSouth: report.abutting_south ?? "",
        abuttingEast: report.abutting_east ?? "",
        abuttingWest: report.abutting_west ?? "",
        legalBases: report.legal_bases ?? DEFAULT_LEGAL_BASES,
        findingsEvaluation: findings,
        roadCategory: report.road_category ?? legacyReport.road_category_info ?? "",
        roadStandardRrow: report.road_standard_rrow ?? "",
        roadActualRrow: report.road_actual_rrow ?? "",
        roadMinSetback: report.road_min_setback ?? "",
        roadAsPerPlan: report.road_as_per_plan ?? "",
        roadRemarks: report.road_remarks ?? "",
        parkingBuildingCode: report.parking_building_code ?? DEFAULT_PARKING_BUILDING_CODE,
        parkingSpaceRequirement:
            report.parking_space_requirement ?? legacyReport.parking_space_requirements ?? "",
        parkingRemarks: report.parking_remarks ?? "",
        typeOfLot: report.type_of_lot ?? "",
        frontSetback: report.front_setback ?? "",
        distanceCenterLineToBuilding: report.distance_center_line_to_building ?? "",
        decisionRecommended: decision,
        inspectorSignature: report.inspector_signature ?? "",
        inspectorDesignation: report.inspector_designation ?? "",
        notedBySignature: report.noted_by_signature ?? "",
        notedByDesignation: report.noted_by_designation ?? "",
    }
}

function defaultInspectorValues(user: ReturnType<typeof useAuthStore.getState>["user"]): Partial<FormValues> {
    if (!user) return {}

    const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ")

    return {
        inspectorSignature: fullName,
        inspectorDesignation: user.designation ?? "Zoning Officer I",
    }
}

function emptyDefaults(documentData?: { status?: string; coordinates?: string | null }): FormValues {
    const today = format(new Date(), "yyyy-MM-dd")

    return {
        dateOfReport: today,
        projectLifeSpan: "Permanent",
        projectSignificance: "Local Significance",
        rightOverLand: "",
        areaDetails: "",
        locationDetails: "",
        inspectionDate: today,
        projectStatusAsOfInspection: documentData?.status
            ? documentData.status.charAt(0).toUpperCase() + documentData.status.slice(1)
            : "",
        gpsCoordinates: documentData?.coordinates ?? "",
        informationProvidedInOrder: "",
        informationProvidedFindings: "",
        abuttingNorth: "",
        abuttingSouth: "",
        abuttingEast: "",
        abuttingWest: "",
        legalBases: DEFAULT_LEGAL_BASES,
        findingsEvaluation: "",
        roadCategory: "",
        roadStandardRrow: "",
        roadActualRrow: "",
        roadMinSetback: "",
        roadAsPerPlan: "",
        roadRemarks: "",
        parkingBuildingCode: DEFAULT_PARKING_BUILDING_CODE,
        parkingSpaceRequirement: "",
        parkingRemarks: "",
        typeOfLot: "",
        frontSetback: "",
        distanceCenterLineToBuilding: "",
        decisionRecommended: "",
        inspectorSignature: "",
        inspectorDesignation: "",
        notedBySignature: "",
        notedByDesignation: "",
    }
}

export function InspectionReportModal({ documentId, open, onClose }: InspectionReportModalProps) {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [showMapPicker, setShowMapPicker] = React.useState(false)
    const [submitMode, setSubmitMode] = React.useState<"draft" | "submit">("draft")

    const { data: documentData, isLoading: isLoadingDocument } = useQuery({
        queryKey: ["document", documentId],
        queryFn: () => DocumentService.getDocument(documentId!),
        enabled: open && !!documentId,
    })

    const { data: reportData, isLoading: isLoadingReport } = useQuery({
        queryKey: ["inspection-report", documentId],
        queryFn: () => DocumentService.getInspectionReport(documentId!),
        enabled: open && !!documentId,
    })

    const existingReport = reportData?.report ?? null
    const isSubmitted = existingReport?.status === "submitted"
    const isReadOnly = isSubmitted

    const form = useForm<FormValues>({
        resolver: zodResolver(draftSchema),
        defaultValues: emptyDefaults(),
    })

    React.useEffect(() => {
        if (!open || !documentData) return

        if (existingReport) {
            form.reset(reportToFormValues(existingReport))
            return
        }

        const prefill = buildInspectionReportPrefill(documentData)

        form.reset({
            ...emptyDefaults(documentData),
            areaDetails: prefill.areaDetails,
            locationDetails: prefill.locationDetails,
            ...defaultInspectorValues(user),
        })
    }, [open, documentData, existingReport, form, user])

    const saveMutation = useMutation({
        mutationFn: async ({ values, submit }: { values: FormValues; submit: boolean }) => {
            const payload = { ...values, submit }

            if (existingReport) {
                return DocumentService.updateInspectionReport(documentId!, existingReport.id, payload)
            }

            return DocumentService.createInspectionReport(documentId!, payload)
        },
        onSuccess: (data, variables) => {
            toast.success(
                variables.submit
                    ? "Evaluation report submitted successfully"
                    : "Evaluation report draft saved"
            )
            queryClient.invalidateQueries({ queryKey: ["inspection-report", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })

            if (variables.submit) {
                onClose()
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to save evaluation report")
        },
    })

    const handleSave = (submit: boolean) => {
        setSubmitMode(submit ? "submit" : "draft")
        form.clearErrors()

        const values = form.getValues()
        const schema = submit ? submitSchema : draftSchema
        const parsed = schema.safeParse(values)

        if (!parsed.success) {
            parsed.error.issues.forEach((issue) => {
                const field = issue.path[0]
                if (typeof field === "string") {
                    form.setError(field as keyof FormValues, { message: issue.message })
                }
            })
            toast.error(
                submit
                    ? "Please complete all required fields before submitting"
                    : "Please fix validation errors before saving"
            )
            return
        }

        saveMutation.mutate({ values: parsed.data, submit })
    }

    const handlePrint = () => {
        if (!documentData || !existingReport) {
            toast.error("Save the evaluation report before printing")
            return
        }

        printInspectionReport(documentData, existingReport)
    }

    const isLoading = isLoadingDocument || isLoadingReport
    const prefill = documentData ? buildInspectionReportPrefill(documentData) : null

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[92dvh] flex flex-col p-0 gap-0">
                    <div className="p-6 pb-4 border-b shrink-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-green-700" />
                                Evaluation Report
                            </DialogTitle>
                            <DialogDescription>
                                {documentData
                                    ? `${documentData.document_title} · ${documentData.zoning_application_no}`
                                    : "Complete the evaluation report for this document."}
                            </DialogDescription>
                        </DialogHeader>
                        {existingReport && (
                            <div className="mt-2">
                                <span
                                    className={`inline-flex text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
                                        isSubmitted
                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                            : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}
                                >
                                    {isSubmitted ? "Submitted" : "Draft"}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {isLoading && (
                            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading evaluation report...
                            </div>
                        )}

                        {!isLoading && documentData && prefill && (
                            <Form {...form}>
                                <form className="space-y-6">
                                <section className="space-y-3">
                                    <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                        A. Applicant and Project Description (from document)
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <ReadOnlyField
                                            label="Locational Clearance #"
                                            value={prefill.locationalClearanceNumber}
                                        />
                                        <ReadOnlyField
                                            label="Date Received"
                                            value={
                                                prefill.dateReceived
                                                    ? format(new Date(prefill.dateReceived), "MMMM d, yyyy")
                                                    : "—"
                                            }
                                        />
                                        <FormField
                                            control={form.control}
                                            name="dateOfReport"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                                                        Date of Report
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input type="date" disabled={isReadOnly} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <ReadOnlyField label="1. Name of Applicant" value={prefill.applicantName} />
                                        <ReadOnlyField label="2. Name of Corporation" value={prefill.corporationName} />
                                        <ReadOnlyField label="3. Address of Applicant" value={prefill.applicantAddress} />
                                        <ReadOnlyField label="4. Address of Corporation" value={prefill.corporationAddress} />
                                        <ReadOnlyField label="5. Project Type" value={prefill.projectType} />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="areaDetails"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>6. Area (in sq.m.)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        rows={3}
                                                        className="resize-none"
                                                        placeholder="Lot and building area details"
                                                        disabled={isReadOnly}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="locationDetails"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>7. Location</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        rows={2}
                                                        className="resize-none"
                                                        disabled={isReadOnly}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                B. Project Evaluation
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <ReadOnlyField
                                                    label="9. Project Classification"
                                                    value={prefill.projectClassification}
                                                />
                                                <ReadOnlyField
                                                    label="10. Site Zoning Classification"
                                                    value={prefill.siteZoningClassification}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="projectLifeSpan"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>8. Project Life Span</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select life span" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Permanent">Permanent</SelectItem>
                                                                    <SelectItem value="Temporary">Temporary</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="projectSignificance"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>11. Project Significance</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select significance" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Local Significance">
                                                                        Local Significance
                                                                    </SelectItem>
                                                                    <SelectItem value="National Significance">
                                                                        National Significance
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="rightOverLand"
                                                    render={({ field }) => (
                                                        <FormItem className="sm:col-span-2">
                                                            <FormLabel>12. Right Over Land</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. Owner; Others: specify details"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="inspectionDate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>13. Date of Inspection</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="gpsCoordinates"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>GPS Coordinates</FormLabel>
                                                            <div className="flex gap-2">
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="lat, lng"
                                                                        disabled={isReadOnly}
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                {!isReadOnly && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        onClick={() => setShowMapPicker(true)}
                                                                    >
                                                                        <MapPin className="h-4 w-4 mr-1" />
                                                                        Pick on Map
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="projectStatusAsOfInspection"
                                                    render={({ field }) => (
                                                        <FormItem className="sm:col-span-2">
                                                            <FormLabel>14. Project Status as of Inspection Date</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select project status" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Proposed">Proposed</SelectItem>
                                                                    <SelectItem value="Operational">Operational</SelectItem>
                                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                                    <SelectItem value="Others">Others</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="informationProvidedInOrder"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>15. Information Provided in Order?</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="yes">Yes</SelectItem>
                                                                    <SelectItem value="no">No</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="informationProvidedFindings"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Specify Findings (if No)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    disabled={isReadOnly}
                                                                    placeholder="Findings when information is not in order"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium">
                                                    16. Existing Land Uses Abutting Lot Boundaries
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="abuttingNorth"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>North</FormLabel>
                                                                <FormControl>
                                                                    <Input disabled={isReadOnly} {...field} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="abuttingSouth"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>South</FormLabel>
                                                                <FormControl>
                                                                    <Input disabled={isReadOnly} {...field} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="abuttingEast"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>East</FormLabel>
                                                                <FormControl>
                                                                    <Input disabled={isReadOnly} {...field} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="abuttingWest"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>West</FormLabel>
                                                                <FormControl>
                                                                    <Input disabled={isReadOnly} {...field} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="legalBases"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>17. Legal Bases</FormLabel>
                                                        <FormControl>
                                                            <Input disabled={isReadOnly} {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="findingsEvaluation"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>18. Findings / Evaluation of Facts</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                rows={5}
                                                                className="resize-none"
                                                                disabled={isReadOnly}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                Road Category
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="roadCategory"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Road Category</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. Brgy. Road"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="roadStandardRrow"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Standard RROW</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="roadActualRrow"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Actual RROW</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="roadMinSetback"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Min. Required Setback</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="roadAsPerPlan"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>As Per Plan</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="roadRemarks"
                                                    render={({ field }) => (
                                                        <FormItem className="sm:col-span-2">
                                                            <FormLabel>Remarks</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                Parking Space Requirement
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="parkingBuildingCode"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>PD1096 — Rev. Building Code</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="parkingSpaceRequirement"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Parking Space Requirement</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="parkingRemarks"
                                                    render={({ field }) => (
                                                        <FormItem className="sm:col-span-2">
                                                            <FormLabel>Remarks</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                Locational Clearance Fields
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="typeOfLot"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Type of Lot</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. Inside Lot"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="frontSetback"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Frontage at Main Road</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. 6.0 METERS FRONT SETBACK"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="distanceCenterLineToBuilding"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Distance Center Line to Building</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. 9.25 METERS"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <FormField
                                                control={form.control}
                                                name="decisionRecommended"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>19. Decision Recommended — Remarks</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                rows={3}
                                                                className="resize-none"
                                                                placeholder="e.g. CONFORMING ZONE, FOR RECOMMENDATION OF THE APPROVING OFFICER."
                                                                disabled={isReadOnly}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                Signatures
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="inspectorSignature"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Inspected by (Name)</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="inspectorDesignation"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Inspected by (Designation)</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="notedBySignature"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Noted by (Name)</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="notedByDesignation"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Noted by (Designation)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. Zoning Officer III/Section Head"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>
                                </form>
                            </Form>
                        )}
                    </div>

                    <div className="p-4 border-t shrink-0 flex flex-wrap items-center justify-end gap-2 bg-zinc-50">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        {existingReport && (
                            <Button type="button" variant="outline" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-1" />
                                Print Report
                            </Button>
                        )}
                        {!isReadOnly && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saveMutation.isPending}
                                    onClick={() => handleSave(false)}
                                >
                                    {saveMutation.isPending && submitMode === "draft"
                                        ? "Saving..."
                                        : "Save Draft"}
                                </Button>
                                <Button
                                    type="button"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={saveMutation.isPending}
                                    onClick={() => handleSave(true)}
                                >
                                    {saveMutation.isPending && submitMode === "submit"
                                        ? "Submitting..."
                                        : "Submit Report"}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <MapPickerModal
                open={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                initialCoordinates={form.watch("gpsCoordinates")}
                onConfirm={(coordinates) => form.setValue("gpsCoordinates", coordinates, { shouldDirty: true })}
            />
        </>
    )
}
