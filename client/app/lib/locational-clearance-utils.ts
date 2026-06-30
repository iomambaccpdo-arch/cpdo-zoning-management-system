import { format } from "date-fns"

import type { Document } from "~/api/DocumentService"
import {
    DEFAULT_LOCATIONAL_CLEARANCE_DECISION,
    formatConditionsList,
    LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS,
    LOCATIONAL_CLEARANCE_CONDITIONS,
} from "~/lib/locational-clearance-conditions"
import { buildLocationalClearanceLocation } from "~/lib/inspection-report-utils"

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
    dateOfInspection: string
    dateOfLcPrepared: string
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
        document.purok?.name ? `Purok ${document.purok.name}` : null,
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

export function buildLocationalClearanceData(document: Document): LocationalClearanceData {
    const report = document.inspection_report
    const projectTypeParts = [document.project_type?.name, document.specific_project_type?.name].filter(Boolean)
    const dateApproved = report?.submitted_at ?? document.created_at

    const latestAttachment = document.attachments
        ?.filter((a) => a.attachment_type !== "oic")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    return {
        applicationNumber: document.zoning_application_no,
        decisionNumber: decisionNumber(document),
        dateReceived: formatDate(document.date_of_application),
        dateApproved: formatDate(dateApproved),
        dateRequirementsComplied: formatDate(latestAttachment?.created_at ?? document.date_of_application),
        applicantName: document.applicant_name,
        corporationName: "",
        applicantAddress: formatAddress(document),
        corporationAddress: "",
        projectType: projectTypeParts.join(" — ") || "—",
        location: buildLocationalClearanceLocation(document, report?.location_details),
        floorArea: document.floor_area ? `${document.floor_area} SQUARE METERS` : "—",
        lotArea: document.lot_area ? `${document.lot_area} SQUARE METERS` : "—",
        frontageAtMainRoad: report?.front_setback?.trim() || "—",
        typeOfLot: report?.type_of_lot?.trim() || "—",
        standardRoadRightOfWay: report?.road_standard_rrow?.trim() || "—",
        distanceCenterLineToBuilding: report?.distance_center_line_to_building?.trim() || "—",
        rightOverLand: report?.right_over_land?.trim() || "—",
        decision: DEFAULT_LOCATIONAL_CLEARANCE_DECISION,
        conditions: formatConditionsList(LOCATIONAL_CLEARANCE_CONDITIONS),
        additionalConditions: formatConditionsList(LOCATIONAL_CLEARANCE_ADDITIONAL_CONDITIONS),
        recommendingApprovalOfficer: recommendingOfficer(document),
        approvingOfficer: document.oic?.trim() || "—",
        orNumber: "—",
        amountPaid: "—",
        datePaid: "—",
        dateOfInspection: formatDate(report?.inspection_date),
        dateOfLcPrepared: formatDate(report?.submitted_at ?? document.updated_at),
        documentTitle: document.document_title,
    }
}

export function checkLocationalClearanceEligibility(
    document: Document,
): LocationalClearanceEligibility {
    const reasons: string[] = []

    if (document.status !== "completed") {
        reasons.push("Document status must be Completed.")
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
