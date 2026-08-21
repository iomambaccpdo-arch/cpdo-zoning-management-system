import { format } from "date-fns"

import type { Document } from "~/api/DocumentService"
import {
    DEFAULT_LOCATIONAL_CLEARANCE_DECISION,
    formatConditionsList,
    LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS,
    LOCATIONAL_CLEARANCE_CONDITIONS,
} from "~/lib/locational-clearance-conditions"
import {
    formatFloorAreaForClearance,
    formatLotAreaForClearance,
    formatPurokName,
} from "~/lib/document-property-utils"
import {
    buildLocationalClearanceLocation,
    encodedProjectTypeFromDocument,
    resolveVerifiedClearanceProjectType,
    resolveVerifiedCoordinates,
} from "~/lib/inspection-report-utils"
import { formatLength } from "~/lib/measurement-utils"

export type LocationalClearanceCopyVariant = "cpdo" | "client"

export const LOCATIONAL_CLEARANCE_COPY_LABELS: Record<LocationalClearanceCopyVariant, string> = {
    cpdo: "CPDO RECEIVED COPY",
    client: "",
}

export interface LocationalClearanceData {
    applicationNumber: string
    decisionNumber: string
    dateReceived: string
    dateApproved: string
    dateRequirementsComplied: string
    applicantName: string
    corporationName: string
    applicantAddress: string
    corporationAddress: string
    projectType: string
    location: string
    floorArea: string
    lotArea: string
    frontageAtMainRoad: string
    typeOfLot: string
    standardRoadRightOfWay: string
    distanceCenterLineToBuilding: string
    rightOverLand: string
    decision: string
    conditions: string
    additionalConditions: string
    recommendingApprovalOfficer: string
    approvingOfficer: string
    orNumber: string
    amountPaid: string
    datePaid: string
    dateOfInspectionAndLcPrepared: string
    documentTitle: string
}

export interface LocationalClearanceEligibility {
    eligible: boolean
    reasons: string[]
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "—"
    try {
        return format(new Date(value), "MMMM d, yyyy")
    } catch {
        return value
    }
}

function formatAddress(document: Document): string {
    const parts = [
        document.landmark,
        formatPurokName(document.purok?.name),
        document.barangay?.name,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ") || "—"
}

function decisionNumber(document: Document): string {
    const applicationNo = document.zoning_application_no.trim()
    const match = applicationNo.match(/(\d{4}-\d{4})\s*$/)

    if (match) {
        return match[1]
    }

    if (applicationNo.toUpperCase().startsWith("LC-")) {
        return applicationNo.slice(3)
    }

    return applicationNo
}

function recommendingOfficer(document: Document): string {
    const report = document.inspection_report

    if (!report) return "—"

    if (report.recommended_for_approval_name?.trim()) {
        const name = report.recommended_for_approval_name.trim()
        if (report.recommended_for_approval_designation?.trim()) {
            return `${name}, ${report.recommended_for_approval_designation.trim()}`
        }
        return name
    }

    if (report.noted_by_signature?.trim()) {
        const name = report.noted_by_signature.trim()
        if (report.noted_by_designation?.trim()) {
            return `${name}, ${report.noted_by_designation.trim()}`
        }
        return name
    }

    if (report.inspector_signature?.trim()) return report.inspector_signature
    if (report.inspector) {
        return `${report.inspector.first_name} ${report.inspector.last_name}`.trim()
    }

    return "—"
}

function approvingOfficer(document: Document): string {
    const report = document.inspection_report

    if (report?.approved_by_name?.trim()) {
        const name = report.approved_by_name.trim()
        if (report.approved_by_designation?.trim()) {
            return `${name}, ${report.approved_by_designation.trim()}`
        }
        return name
    }

    return document.oic?.trim() || "—"
}

function additionalConditionsText(document: Document): string {
    const fromReport = document.inspection_report?.additional_conditions?.trim()
    if (fromReport) {
        return fromReport
    }

    return formatConditionsList(LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS)
}

function paymentOrNumber(document: Document): string {
    return document.or_number?.trim() || "—"
}

function paymentAmount(document: Document): string {
    if (document.amount_paid === null || document.amount_paid === undefined || document.amount_paid === "") {
        return "—"
    }

    const amount = Number(document.amount_paid)
    if (Number.isNaN(amount)) {
        return "—"
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

export function buildLocationalClearanceData(document: Document): LocationalClearanceData {
    const report = document.inspection_report
    const dateApproved = report?.submitted_at ?? document.created_at

    return {
        applicationNumber: document.zoning_application_no,
        decisionNumber: decisionNumber(document),
        dateReceived: formatDate(document.date_of_application),
        dateApproved: formatDate(dateApproved),
        dateRequirementsComplied: formatDate(document.date_requirements_complied),
        applicantName: document.applicant_name,
        corporationName: document.corporation_name?.trim() || "",
        applicantAddress: formatAddress(document),
        corporationAddress: document.corporation_address?.trim() || "",
        projectType: resolveVerifiedClearanceProjectType(
            encodedProjectTypeFromDocument(document),
            report?.field_verifications,
        ),
        location: buildLocationalClearanceLocation(
            document,
            report?.location_details,
            report?.landmark,
            resolveVerifiedCoordinates(
                document.coordinates,
                report?.field_verifications,
                report?.gps_coordinates,
            ),
        ),
        floorArea: formatFloorAreaForClearance(document),
        lotArea: formatLotAreaForClearance(document),
        frontageAtMainRoad: formatLength(report?.front_setback, "—"),
        typeOfLot: report?.type_of_lot?.trim() || "—",
        standardRoadRightOfWay: formatLength(report?.road_standard_rrow, "—"),
        distanceCenterLineToBuilding: formatLength(report?.distance_center_line_to_building, "—"),
        rightOverLand: report?.right_over_land?.trim() || "—",
        decision: DEFAULT_LOCATIONAL_CLEARANCE_DECISION,
        conditions: formatConditionsList(LOCATIONAL_CLEARANCE_CONDITIONS),
        additionalConditions: additionalConditionsText(document),
        recommendingApprovalOfficer: recommendingOfficer(document),
        approvingOfficer: approvingOfficer(document),
        orNumber: paymentOrNumber(document),
        amountPaid: paymentAmount(document),
        datePaid: formatDate(document.date_paid),
        dateOfInspectionAndLcPrepared: formatDate(
            report?.inspection_date ?? report?.submitted_at ?? new Date().toISOString(),
        ),
        documentTitle: document.document_title,
    }
}

export function checkLocationalClearanceEligibility(
    document: Document,
): LocationalClearanceEligibility {
    const reasons: string[] = []

    if (document.status !== "approved") {
        reasons.push("Document status must be Approved.")
    }

    if (!document.inspection_report || document.inspection_report.status !== "submitted") {
        reasons.push("Inspection Report must be completed and submitted.")
    }

    if (!document.oic?.trim()) {
        reasons.push("Approving officer (OIC) must be assigned.")
    }

    return {
        eligible: reasons.length === 0,
        reasons,
    }
}

export function hasGeneratedLocationalClearance(document: Document): boolean {
    return Boolean(document.locational_clearance_generated_at)
}
