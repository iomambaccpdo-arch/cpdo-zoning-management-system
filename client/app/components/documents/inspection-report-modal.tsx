import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ClipboardCheck, Loader2, MapPin, Plus, Printer, Trash2 } from "lucide-react"
import { useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form"
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
import { Checkbox } from "~/components/ui/checkbox"
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
import { InspectionPhotosSection } from "~/components/documents/inspection-photos-section"
import {
    defaultZoningOfficerReviewValues,
    ZoningOfficerReviewSection,
    type ZoningOfficerReviewValues,
} from "~/components/documents/zoning-officer-review-section"
import {
    buildInspectionReportPrefill,
    buildVerifiableFieldKeys,
    DEFAULT_PARKING_BUILDING_CODE,
    defaultFrontages,
    determineInspectionRecommendation,
    emptyFieldVerifications,
    emptyFrontageRoad,
    emptyParkingSpaceRequirement,
    FRONTAGE_ROAD_OPTIONS,
    nextFrontageRoadLabel,
    normalizeFieldVerifications,
    normalizeFrontages,
    normalizeParkingSpaceRequirement,
    PARKING_SPACE_VEHICLE_TYPES,
    PROJECT_STATUS_OPTIONS,
    resolvedVerifiedValue,
    RIGHT_OVER_LAND_OPTIONS,
    STANDARD_RROW_OPTIONS,
    TYPE_OF_LOT_OPTIONS,
    type InspectionReportPrefill,
} from "~/lib/inspection-report-utils"
import { useAuthStore } from "~/store/auth"
import { canReturnInspectionReport, canReviewInspectionReport } from "~/lib/permissions"

const fieldVerificationEntrySchema = z.object({
    verified: z.boolean(),
    correction: z.string().max(2000).optional(),
})

const optionalDecimalString = z
    .string()
    .max(255)
    .refine(
        (value) => value.trim() === "" || /^\d+(\.\d+)?$/.test(value.trim()),
        { message: "Must be a number" },
    )
    .optional()

const optionalIntegerString = z
    .string()
    .max(255)
    .refine(
        (value) => value.trim() === "" || /^\d+$/.test(value.trim()),
        { message: "Must be a whole number" },
    )
    .optional()

const parkingSpaceRequirementSchema = z.object({
    car: optionalIntegerString,
    bus: optionalIntegerString,
    articulated_vehicle: optionalIntegerString,
    standard_truck: optionalIntegerString,
    jeepney_shuttle: optionalIntegerString,
})

const frontageRoadSchema = z.object({
    key: z.string(),
    label: z.string(),
    name: z.string().max(255).optional(),
    standardRrow: z.string().max(255).optional(),
    actualRrow: optionalDecimalString,
    minSetback: optionalDecimalString,
    asPerPlan: optionalDecimalString,
    frontage: optionalDecimalString,
    remarks: z.string().max(5000).optional(),
})

const draftSchema = z.object({
    projectSignificance: z.string().max(255).optional(),
    rightOverLand: z.string().max(255).optional(),
    landmark: z.string().max(255).optional(),
    fieldVerifications: z.record(z.string(), fieldVerificationEntrySchema).optional(),
    inspectionDate: z.string().optional(),
    projectStatusAsOfInspection: z.string().max(255).optional(),
    gpsCoordinates: z.string().max(255).optional(),
    abuttingNorth: z.string().max(255).optional(),
    abuttingSouth: z.string().max(255).optional(),
    abuttingEast: z.string().max(255).optional(),
    abuttingWest: z.string().max(255).optional(),
    findingsEvaluation: z.string().max(10000).optional(),
    frontages: z.array(frontageRoadSchema).min(1).max(FRONTAGE_ROAD_OPTIONS.length).optional(),
    parkingBuildingCode: z.string().max(255).optional(),
    parkingSpaceRequirement: parkingSpaceRequirementSchema.optional(),
    parkingAsPerPlan: parkingSpaceRequirementSchema.optional(),
    parkingRemarks: z.string().max(5000).optional(),
    typeOfLot: z.string().max(255).optional(),
    lackingDocuments: z.string().max(255).optional(),
    distanceCenterLineToBuilding: optionalDecimalString,
    decisionRecommended: z.string().max(5000).optional(),
    inspectorSignature: z.string().max(255).optional(),
    inspectorDesignation: z.string().max(255).optional(),
    notedBySignature: z.string().max(255).optional(),
    notedByDesignation: z.string().max(255).optional(),
})

const submitSchema = z
    .object({
        projectSignificance: z.string().min(1, "Project significance is required"),
        rightOverLand: z.string().min(1, "Right over land is required"),
        landmark: z.string().max(255).optional(),
        fieldVerifications: z.record(z.string(), fieldVerificationEntrySchema).optional(),
        inspectionDate: z.string().min(1, "Date of inspection is required"),
        projectStatusAsOfInspection: z.string().min(1, "Project status is required"),
        gpsCoordinates: z.string().min(1, "GPS coordinates are required"),
        abuttingNorth: z.string().min(1, "North abutting land use is required"),
        abuttingSouth: z.string().min(1, "South abutting land use is required"),
        abuttingEast: z.string().min(1, "East abutting land use is required"),
        abuttingWest: z.string().min(1, "West abutting land use is required"),
        findingsEvaluation: z.string().max(10000).optional(),
        frontages: z.array(frontageRoadSchema).min(1).max(FRONTAGE_ROAD_OPTIONS.length),
        parkingBuildingCode: z.string().max(255).optional(),
        parkingSpaceRequirement: parkingSpaceRequirementSchema.optional(),
        parkingAsPerPlan: parkingSpaceRequirementSchema.optional(),
        parkingRemarks: z.string().max(5000).optional(),
        typeOfLot: z.string().min(1, "Project lot type is required"),
        lackingDocuments: z.string().min(1, "Lacking documents is required"),
        distanceCenterLineToBuilding: z
            .string()
            .min(1, "Distance from RROW centerline is required")
            .refine(
                (value) => /^\d+(\.\d+)?$/.test(value.trim()),
                { message: "Must be a number" },
            ),
        decisionRecommended: z.string().max(5000).optional(),
        inspectorSignature: z.string().min(1, "Inspector signature is required"),
        inspectorDesignation: z.string().max(255).optional(),
        notedBySignature: z.string().max(255).optional(),
        notedByDesignation: z.string().max(255).optional(),
    })
    .superRefine((data, ctx) => {
        const verifications = data.fieldVerifications ?? {}
        for (const [key, entry] of Object.entries(verifications)) {
            if (!entry.verified && !entry.correction?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Enter the correct information or mark as verified",
                    path: ["fieldVerifications", key, "correction"],
                })
            }
        }

        const main = data.frontages?.[0]
        if (!main?.name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Road name is required",
                path: ["frontages", 0, "name"],
            })
        }
        if (!main?.standardRrow?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Standard RROW is required",
                path: ["frontages", 0, "standardRrow"],
            })
        }
        if (!main?.actualRrow?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Actual RROW is required",
                path: ["frontages", 0, "actualRrow"],
            })
        }
        if (!main?.minSetback?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Minimum setback is required",
                path: ["frontages", 0, "minSetback"],
            })
        }
        if (!main?.asPerPlan?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Setback as per plan is required",
                path: ["frontages", 0, "asPerPlan"],
            })
        }
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

function VerifiableField({
    label,
    value,
    fieldKey,
    disabled,
}: {
    label: string
    value: string
    fieldKey: string
    disabled: boolean
}) {
    const { control, setValue } = useFormContext<FormValues>()
    const verified = useWatch({
        control,
        name: `fieldVerifications.${fieldKey}.verified` as const,
    })

    return (
        <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
            <ReadOnlyField label={label} value={value} />
            <FormField
                control={control}
                name={`fieldVerifications.${fieldKey}.verified`}
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={Boolean(field.value)}
                                disabled={disabled}
                                onCheckedChange={(checked) => {
                                    const isVerified = checked === true
                                    field.onChange(isVerified)
                                    if (isVerified) {
                                        setValue(
                                            `fieldVerifications.${fieldKey}.correction`,
                                            "",
                                            { shouldDirty: true },
                                        )
                                    }
                                }}
                            />
                        </FormControl>
                        <FormLabel className="text-sm font-normal text-zinc-700">Verified</FormLabel>
                    </FormItem>
                )}
            />
            {!verified && (
                <FormField
                    control={control}
                    name={`fieldVerifications.${fieldKey}.correction`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correct Information</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="Enter the correct information"
                                    {...field}
                                    value={field.value ?? ""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </div>
    )
}

function reportToFormValues(
    report: InspectionReport,
    prefill: InspectionReportPrefill,
): FormValues {
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

    // Legacy reports stored legal bases separately; fold into findings for editing.
    const legacyLegalBases = (report as InspectionReport & { legal_bases?: string | null }).legal_bases?.trim()
    if (legacyLegalBases) {
        if (!findings) {
            findings = legacyLegalBases
        } else if (!findings.includes(legacyLegalBases)) {
            findings = `${legacyLegalBases}\n\n${findings}`
        }
    }

    let decision = report.decision_recommended ?? ""
    if (!decision && legacyReport.remarks) {
        decision = legacyReport.remarks
    }

    const verificationKeys = buildVerifiableFieldKeys(prefill)

    return {
        projectSignificance: report.project_significance ?? "",
        rightOverLand: report.right_over_land ?? "",
        landmark: report.landmark ?? "",
        fieldVerifications: normalizeFieldVerifications(
            verificationKeys,
            report.field_verifications,
        ),
        inspectionDate: report.inspection_date ?? "",
        projectStatusAsOfInspection: report.project_status_as_of_inspection ?? "",
        gpsCoordinates: report.gps_coordinates ?? "",
        abuttingNorth: report.abutting_north ?? "",
        abuttingSouth: report.abutting_south ?? "",
        abuttingEast: report.abutting_east ?? "",
        abuttingWest: report.abutting_west ?? "",
        findingsEvaluation: findings,
        frontages: normalizeFrontages(report.frontages, {
            road_category: report.road_category ?? legacyReport.road_category_info ?? "",
            road_standard_rrow: report.road_standard_rrow,
            road_actual_rrow: report.road_actual_rrow,
            road_min_setback: report.road_min_setback,
            road_as_per_plan: report.road_as_per_plan,
            front_setback: report.front_setback,
        }),
        parkingBuildingCode: report.parking_building_code ?? DEFAULT_PARKING_BUILDING_CODE,
        parkingSpaceRequirement: normalizeParkingSpaceRequirement(
            report.parking_space_requirement,
        ),
        parkingAsPerPlan: normalizeParkingSpaceRequirement(
            report.parking_as_per_plan,
        ),
        parkingRemarks: report.parking_remarks ?? "",
        typeOfLot: report.type_of_lot ?? "",
        lackingDocuments: report.lacking_documents ?? "N/A",
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

function emptyDefaults(
    documentData?: { coordinates?: string | null },
    prefill?: InspectionReportPrefill | null,
): FormValues {
    const today = format(new Date(), "yyyy-MM-dd")
    const verificationKeys = prefill ? buildVerifiableFieldKeys(prefill) : []

    return {
        projectSignificance: "Local Significance",
        rightOverLand: "",
        landmark: "",
        fieldVerifications: emptyFieldVerifications(verificationKeys),
        inspectionDate: today,
        projectStatusAsOfInspection: "",
        gpsCoordinates: documentData?.coordinates ?? "",
        abuttingNorth: "",
        abuttingSouth: "",
        abuttingEast: "",
        abuttingWest: "",
        findingsEvaluation: "",
        frontages: defaultFrontages(),
        parkingBuildingCode: DEFAULT_PARKING_BUILDING_CODE,
        parkingSpaceRequirement: emptyParkingSpaceRequirement(),
        parkingAsPerPlan: emptyParkingSpaceRequirement(),
        parkingRemarks: "",
        typeOfLot: "",
        lackingDocuments: "N/A",
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
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const [reviewValues, setReviewValues] = React.useState<ZoningOfficerReviewValues>(
        defaultZoningOfficerReviewValues,
    )
    const [reviewErrors, setReviewErrors] = React.useState<
        Partial<Record<keyof ZoningOfficerReviewValues, string>>
    >({})

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
    const canReturn = canReturnInspectionReport(user)
    const canReview = canReviewInspectionReport(user)
    const documentStatus = documentData?.status ?? reportData?.document?.status
    const canMarkReviewed = canReview && isSubmitted && documentStatus === "inspected"
    const hasZoningReview = Boolean(
        existingReport?.reviewed_at ||
            existingReport?.additional_conditions ||
            existingReport?.recommended_for_approval_name ||
            existingReport?.approved_by_name ||
            existingReport?.reviewed_report_attachment,
    )
    const showZoningReview = canMarkReviewed || hasZoningReview

    const form = useForm<FormValues>({
        resolver: zodResolver(draftSchema),
        defaultValues: emptyDefaults(),
    })

    const {
        fields: frontageFields,
        append: appendFrontage,
        remove: removeFrontage,
    } = useFieldArray({
        control: form.control,
        name: "frontages",
    })

    React.useEffect(() => {
        if (!open || !documentData) return

        const prefillData = buildInspectionReportPrefill(documentData)

        if (existingReport) {
            form.reset(reportToFormValues(existingReport, prefillData))
            setReviewValues({
                ...defaultZoningOfficerReviewValues(),
                additionalConditions:
                    existingReport.additional_conditions?.trim() ||
                    defaultZoningOfficerReviewValues().additionalConditions,
                recommendedForApprovalName:
                    existingReport.recommended_for_approval_name ?? "",
                recommendedForApprovalDesignation:
                    existingReport.recommended_for_approval_designation ?? "",
                approvedByName: existingReport.approved_by_name ?? "",
                approvedByDesignation: existingReport.approved_by_designation ?? "",
                reviewedReport: null,
            })
            setReviewErrors({})
            return
        }

        form.reset({
            ...emptyDefaults(documentData, prefillData),
            ...defaultInspectorValues(user),
        })
        setReviewValues(defaultZoningOfficerReviewValues())
        setReviewErrors({})
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
            queryClient.invalidateQueries({ queryKey: ["inspection-report-photos", documentId] })
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

    const returnMutation = useMutation({
        mutationFn: async () => {
            if (!existingReport) {
                throw new Error("No inspection report to return")
            }

            return DocumentService.returnInspectionReportForRevision(documentId!, existingReport.id)
        },
        onSuccess: () => {
            toast.success("Evaluation report returned for revision")
            queryClient.invalidateQueries({ queryKey: ["inspection-report", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || "Failed to return evaluation report")
        },
    })

    const reviewMutation = useMutation({
        mutationFn: async () => {
            if (!existingReport) {
                throw new Error("No inspection report to review")
            }

            if (!reviewValues.reviewedReport) {
                throw new Error("Reviewed inspection report PDF is required")
            }

            setUploadProgress(0)
            return DocumentService.reviewInspectionReport(
                documentId!,
                existingReport.id,
                {
                    additionalConditions: reviewValues.additionalConditions,
                    recommendedForApprovalName: reviewValues.recommendedForApprovalName,
                    recommendedForApprovalDesignation: reviewValues.recommendedForApprovalDesignation,
                    approvedByName: reviewValues.approvedByName,
                    approvedByDesignation: reviewValues.approvedByDesignation,
                    reviewedReport: reviewValues.reviewedReport,
                },
                setUploadProgress,
            )
        },
        onSuccess: () => {
            setUploadProgress(0)
            toast.success("Inspection report marked as reviewed")
            queryClient.invalidateQueries({ queryKey: ["inspection-report", documentId] })
            queryClient.invalidateQueries({ queryKey: ["document", documentId] })
            queryClient.invalidateQueries({ queryKey: ["documents"] })
            queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] })
            queryClient.invalidateQueries({ queryKey: ["dashboard"] })
            onClose()
        },
        onError: (error: any) => {
            setUploadProgress(0)
            toast.error(error?.response?.data?.message || "Failed to review inspection report")
        },
    })

    const handleMarkReviewed = () => {
        const nextErrors: Partial<Record<keyof ZoningOfficerReviewValues, string>> = {}

        if (!reviewValues.reviewedReport) {
            nextErrors.reviewedReport = "Upload the reviewed inspection report PDF"
        }
        if (!reviewValues.additionalConditions.trim()) {
            nextErrors.additionalConditions = "Additional conditions are required"
        }
        if (!reviewValues.recommendedForApprovalName.trim()) {
            nextErrors.recommendedForApprovalName = "Name is required"
        }
        if (!reviewValues.recommendedForApprovalDesignation.trim()) {
            nextErrors.recommendedForApprovalDesignation = "Designation is required"
        }
        if (!reviewValues.approvedByName.trim()) {
            nextErrors.approvedByName = "Name is required"
        }
        if (!reviewValues.approvedByDesignation.trim()) {
            nextErrors.approvedByDesignation = "Designation is required"
        }

        setReviewErrors(nextErrors)

        if (Object.keys(nextErrors).length > 0) {
            toast.error("Complete the Zoning Officer review fields before marking as reviewed")
            return
        }

        reviewMutation.mutate()
    }

    const handleSave = (submit: boolean) => {
        setSubmitMode(submit ? "submit" : "draft")
        form.clearErrors()

        const values = form.getValues()
        const schema = submit ? submitSchema : draftSchema
        const parsed = schema.safeParse(values)

        if (!parsed.success) {
            parsed.error.issues.forEach((issue) => {
                const path = issue.path
                if (path.length === 0) {
                    return
                }

                const fieldPath = path.join(".") as keyof FormValues & string
                form.setError(fieldPath as any, { message: issue.message })
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

    const { data: inspectionPhotos = [] } = useQuery({
        queryKey: ["inspection-report-photos", documentId],
        queryFn: () => DocumentService.getInspectionReportPhotos(documentId!),
        enabled: open && !!documentId && !!existingReport,
    })

    const watchedValues = useWatch({ control: form.control })
    const autoRecommendation = React.useMemo(() => {
        if (!prefill) {
            return ""
        }

        const verifications = watchedValues.fieldVerifications

        return determineInspectionRecommendation({
            projectZoningClassification: resolvedVerifiedValue(
                prefill.projectClassification,
                verifications,
                "project_classification",
            ),
            siteZoningClassification: resolvedVerifiedValue(
                prefill.siteZoningClassification,
                verifications,
                "site_zoning_classification",
            ),
            projectSignificance: watchedValues.projectSignificance,
            rightOverLand: watchedValues.rightOverLand,
            inspectionDate: watchedValues.inspectionDate,
            projectStatusAsOfInspection: watchedValues.projectStatusAsOfInspection,
            hasInspectionPhotos: inspectionPhotos.length > 0,
            abuttingNorth: watchedValues.abuttingNorth,
            abuttingEast: watchedValues.abuttingEast,
            abuttingSouth: watchedValues.abuttingSouth,
            abuttingWest: watchedValues.abuttingWest,
            frontages: watchedValues.frontages,
            distanceCenterLineToBuilding: watchedValues.distanceCenterLineToBuilding,
            parkingSpaceRequirement: watchedValues.parkingSpaceRequirement,
            parkingAsPerPlan: watchedValues.parkingAsPerPlan,
            typeOfLot: watchedValues.typeOfLot,
            lackingDocuments: watchedValues.lackingDocuments,
        })
    }, [prefill, watchedValues, inspectionPhotos.length])

    React.useEffect(() => {
        if (isReadOnly) {
            return
        }

        const current = form.getValues("decisionRecommended")
        if (current !== autoRecommendation) {
            form.setValue("decisionRecommended", autoRecommendation, { shouldDirty: true })
        }
    }, [autoRecommendation, form, isReadOnly])

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
                                        I. Applicant and Project Description (from document)
                                    </h3>
                                    <p className="text-[12px] text-zinc-500">
                                        Mark each field as Verified if it matches the site inspection. Leave
                                        unchecked and enter the correct information when a discrepancy is found.
                                        Corrections are saved with this report and do not change the original
                                        application.
                                    </p>
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
                                        <ReadOnlyField
                                            label="Date of Report"
                                            value={
                                                existingReport?.date_of_report
                                                    ? format(
                                                          new Date(existingReport.date_of_report),
                                                          "MMMM d, yyyy"
                                                      )
                                                    : "Generated on submit"
                                            }
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <VerifiableField
                                            label="Name of Applicant"
                                            value={prefill.applicantName}
                                            fieldKey="applicant_name"
                                            disabled={isReadOnly}
                                        />
                                        <VerifiableField
                                            label="Address of Applicant"
                                            value={prefill.applicantAddress}
                                            fieldKey="applicant_address"
                                            disabled={isReadOnly}
                                        />
                                        <VerifiableField
                                            label="Name of Corporation (if applicable)"
                                            value={prefill.corporationName}
                                            fieldKey="corporation_name"
                                            disabled={isReadOnly}
                                        />
                                        <VerifiableField
                                            label="Address of Corporation (if applicable)"
                                            value={prefill.corporationAddress}
                                            fieldKey="corporation_address"
                                            disabled={isReadOnly}
                                        />
                                        <VerifiableField
                                            label="Project Type"
                                            value={prefill.projectType}
                                            fieldKey="project_type"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                                            Project Area
                                        </p>
                                        {prefill.buildings.length > 0 || prefill.lots.length > 0 ? (
                                            <div className="space-y-3">
                                                {prefill.lots.map((lot, index) => (
                                                    <div
                                                        key={`lot-${index}`}
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                                                    >
                                                        <VerifiableField
                                                            label={`Lot ${index + 1} Land Title / TCT`}
                                                            value={lot.land_title}
                                                            fieldKey={`lot_${index}_land_title`}
                                                            disabled={isReadOnly}
                                                        />
                                                        <VerifiableField
                                                            label={`Lot ${index + 1} Area`}
                                                            value={lot.area ? `${lot.area} sq.m.` : "—"}
                                                            fieldKey={`lot_${index}_area`}
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                ))}
                                                {prefill.buildings.map((building, index) => (
                                                    <div
                                                        key={`building-${index}`}
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                                                    >
                                                        <VerifiableField
                                                            label={`Building ${index + 1} Name`}
                                                            value={building.name}
                                                            fieldKey={`building_${index}_name`}
                                                            disabled={isReadOnly}
                                                        />
                                                        <VerifiableField
                                                            label={`Building ${index + 1} Area`}
                                                            value={building.area ? `${building.area} sq.m.` : "—"}
                                                            fieldKey={`building_${index}_area`}
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <VerifiableField
                                                label="Area details"
                                                value={prefill.areaDetails}
                                                fieldKey="area_details"
                                                disabled={isReadOnly}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                                            Project Location
                                        </p>
                                        <VerifiableField
                                            label="Address"
                                            value={prefill.locationDetails}
                                            fieldKey="location"
                                            disabled={isReadOnly}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="landmark"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Landmark</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            disabled={isReadOnly}
                                                            placeholder="e.g. Along Coastal Road"
                                                            {...field}
                                                        />
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
                                                    <FormLabel>Geographic Coordinates</FormLabel>
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
                                    </div>
                                    <VerifiableField
                                        label="Project Zoning Classification"
                                        value={prefill.projectClassification}
                                        fieldKey="project_classification"
                                        disabled={isReadOnly}
                                    />
                                </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                II. Project Evaluation
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <VerifiableField
                                                    label="Site Zoning Classification"
                                                    value={prefill.siteZoningClassification}
                                                    fieldKey="site_zoning_classification"
                                                    disabled={isReadOnly}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="projectSignificance"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Project Significance</FormLabel>
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
                                                            <FormLabel>Right Over Land</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select right over land" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {RIGHT_OVER_LAND_OPTIONS.map((option) => (
                                                                        <SelectItem key={option} value={option}>
                                                                            {option}
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
                                                    name="inspectionDate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Date of Inspection</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="projectStatusAsOfInspection"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Project Status as of Inspection Date</FormLabel>
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
                                                                    {PROJECT_STATUS_OPTIONS.map((status) => (
                                                                        <SelectItem key={status} value={status}>
                                                                            {status}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>

                                        <InspectionPhotosSection
                                            documentId={documentId!}
                                            hasReport={!!existingReport}
                                            isReadOnly={isReadOnly}
                                        />

                                        <section className="space-y-3">
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium">
                                                    Land Uses of Abutting Lots
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
                                                                <FormMessage />
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
                                                                <FormMessage />
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
                                                                <FormMessage />
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
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between gap-3 border-b pb-1">
                                                <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700">
                                                    Road Right of Way & Project Setback Compliance
                                                </h3>
                                                {!isReadOnly && nextFrontageRoadLabel(frontageFields.length) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => appendFrontage(emptyFrontageRoad(frontageFields.length))}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add {nextFrontageRoadLabel(frontageFields.length)}
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-[12px] text-zinc-500">
                                                Main Road is required. Add 2nd–4th Road only when applicable.
                                            </p>
                                            <FormField
                                                control={form.control}
                                                name="distanceCenterLineToBuilding"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Distance from RROW Centerline to Nearest Building
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="any"
                                                                min="0"
                                                                placeholder="e.g. 9.25"
                                                                disabled={isReadOnly}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {frontageFields.map((frontageField, index) => {
                                                const roadLabel = FRONTAGE_ROAD_OPTIONS[index]?.label ?? frontageField.label

                                                return (
                                                    <div
                                                        key={frontageField.id}
                                                        className="rounded-md border border-zinc-200 p-4 space-y-3 bg-zinc-50/40"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-medium text-zinc-700">
                                                                {roadLabel}
                                                                {index === 0 ? " (Mandatory)" : ""}
                                                            </p>
                                                            {!isReadOnly && index > 0 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700"
                                                                    onClick={() => removeFrontage(index)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                                    Remove
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <FormField
                                                                control={form.control}
                                                                name={`frontages.${index}.name`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Road Name</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                placeholder="e.g. Brgy. Road"
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
                                                                name={`frontages.${index}.standardRrow`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Standard RROW</FormLabel>
                                                                        <Select
                                                                            disabled={isReadOnly}
                                                                            onValueChange={field.onChange}
                                                                            value={field.value}
                                                                        >
                                                                            <FormControl>
                                                                                <SelectTrigger>
                                                                                    <SelectValue placeholder="Select standard RROW" />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                {STANDARD_RROW_OPTIONS.map((option) => (
                                                                                    <SelectItem key={option} value={option}>
                                                                                        {option}
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
                                                                name={`frontages.${index}.actualRrow`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Actual RROW</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                step="any"
                                                                                min="0"
                                                                                placeholder="e.g. 6.0"
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
                                                                name={`frontages.${index}.frontage`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Frontage (m)</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                step="any"
                                                                                min="0"
                                                                                placeholder="e.g. 12.0"
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
                                                                name={`frontages.${index}.minSetback`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Setback — Minimum Requirement</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                step="any"
                                                                                min="0"
                                                                                placeholder="e.g. 3.0"
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
                                                                name={`frontages.${index}.asPerPlan`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Setback — As Per Plan</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                step="any"
                                                                                min="0"
                                                                                placeholder="e.g. 3.0"
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
                                                                name={`frontages.${index}.remarks`}
                                                                render={({ field }) => (
                                                                    <FormItem className="sm:col-span-2">
                                                                        <FormLabel>Remarks</FormLabel>
                                                                        <FormControl>
                                                                            <Input disabled={isReadOnly} {...field} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700 border-b pb-1">
                                                Project Parking Compliance
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="parkingBuildingCode"
                                                    render={({ field }) => (
                                                        <FormItem className="sm:col-span-2">
                                                            <FormLabel>PD1096 — Rev. Building Code</FormLabel>
                                                            <FormControl>
                                                                <Input disabled={isReadOnly} {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium">Minimum Requirement</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {PARKING_SPACE_VEHICLE_TYPES.map(({ key, label }) => (
                                                        <FormField
                                                            key={`min-${key}`}
                                                            control={form.control}
                                                            name={`parkingSpaceRequirement.${key}`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>{label}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            step="1"
                                                                            min="0"
                                                                            placeholder="No. of slots"
                                                                            disabled={isReadOnly}
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium">As Per Plan</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {PARKING_SPACE_VEHICLE_TYPES.map(({ key, label }) => (
                                                        <FormField
                                                            key={`plan-${key}`}
                                                            control={form.control}
                                                            name={`parkingAsPerPlan.${key}`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>{label}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            step="1"
                                                                            min="0"
                                                                            placeholder="No. of slots"
                                                                            disabled={isReadOnly}
                                                                            {...field}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="parkingRemarks"
                                                    render={({ field }) => (
                                                        <FormItem>
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
                                                Project Lot Type & Lacking Documents
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="typeOfLot"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Project Lot Type</FormLabel>
                                                            <Select
                                                                disabled={isReadOnly}
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select type of lot" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {TYPE_OF_LOT_OPTIONS.map((option) => (
                                                                        <SelectItem key={option} value={option}>
                                                                            {option}
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
                                                    name="lackingDocuments"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Lacking Documents</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    disabled={isReadOnly}
                                                                    placeholder="N/A"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="findingsEvaluation"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Findings / Evaluation of Facts (optional)</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                rows={4}
                                                                className="resize-none"
                                                                placeholder="Optional notes, legal basis, or evaluation findings"
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
                                                Recommendation
                                            </h3>
                                            <ReadOnlyField
                                                label="Automatically determined from inspection findings"
                                                value={autoRecommendation || "Complete evaluation fields to generate recommendation"}
                                            />
                                            <input type="hidden" {...form.register("decisionRecommended")} />
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
                                                                    placeholder="e.g. Zoning Officer III"
                                                                    disabled={isReadOnly}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </section>

                                        {showZoningReview && (
                                            <ZoningOfficerReviewSection
                                                editable={canMarkReviewed}
                                                values={reviewValues}
                                                onChange={(next) => {
                                                    setReviewValues(next)
                                                    setReviewErrors({})
                                                }}
                                                errors={reviewErrors}
                                                existingAttachment={
                                                    existingReport?.reviewed_report_attachment
                                                }
                                            />
                                        )}
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
                        {isSubmitted && canReturn && (
                            <Button
                                type="button"
                                variant="outline"
                                className="border-amber-300 text-amber-800 hover:bg-amber-50"
                                disabled={returnMutation.isPending || saveMutation.isPending || reviewMutation.isPending}
                                onClick={() => returnMutation.mutate()}
                            >
                                {returnMutation.isPending ? "Returning..." : "Return for Revision"}
                            </Button>
                        )}
                        {canMarkReviewed && (
                            <Button
                                type="button"
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                                disabled={reviewMutation.isPending || returnMutation.isPending || saveMutation.isPending}
                                onClick={handleMarkReviewed}
                            >
                                {reviewMutation.isPending
                                    ? uploadProgress > 0 && uploadProgress < 100
                                        ? `Uploading... ${uploadProgress}%`
                                        : "Reviewing..."
                                    : "Mark as Reviewed"}
                            </Button>
                        )}
                        {!isReadOnly && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={saveMutation.isPending || returnMutation.isPending || reviewMutation.isPending}
                                    onClick={() => handleSave(false)}
                                >
                                    {saveMutation.isPending && submitMode === "draft"
                                        ? "Saving..."
                                        : "Save Draft"}
                                </Button>
                                <Button
                                    type="button"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={saveMutation.isPending || returnMutation.isPending || reviewMutation.isPending}
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
