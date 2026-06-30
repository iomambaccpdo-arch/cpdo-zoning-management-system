import type { Document } from "~/api/DocumentService"

export interface InspectionReportPrefill {
    locationalClearanceNumber: string
    dateReceived: string
    applicantName: string
    corporationName: string
    applicantAddress: string
    corporationAddress: string
    projectType: string
    areaDetails: string
    locationDetails: string
    projectClassification: string
    siteZoningClassification: string
}

export const DEFAULT_LEGAL_BASES = "Ordinance No. 06-12/"

export const DEFAULT_PARKING_BUILDING_CODE = "ONE (1) CAR SLOT FOR EVERY UNIT"

export function formatDocumentAddress(document: Document): string {
    const parts = [
        document.landmark,
        document.purok?.name ? `Purok ${document.purok.name}` : null,
        document.barangay?.name,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ")
}

export function buildDefaultAreaDetails(document: Document): string {
    const lotLine = document.lot_area ? `Lot: ${document.lot_area} SQ.M` : null
    const bldgLine = document.floor_area
        ? `Bldg: ${document.floor_area} SQ.M AS PER PLAN`
        : null

    return [lotLine, bldgLine].filter(Boolean).join("\n")
}

export function buildDefaultLocationDetails(document: Document): string {
    const parts = [
        document.purok?.name ? `Purok ${document.purok.name}` : null,
        document.barangay?.name ? `Brgy. ${document.barangay.name}` : null,
        document.landmark,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ")
}

export function buildLocationalClearanceLocation(document: Document, locationDetails?: string | null): string {
    const coords = document.coordinates?.trim()
    const location = locationDetails?.trim() || buildDefaultLocationDetails(document)

    if (coords) {
        return `${coords} / ${location}`
    }

    return location
}

export function buildInspectionReportPrefill(document: Document): InspectionReportPrefill {
    const projectTypeParts = [
        document.project_type?.name,
        document.specific_project_type?.name,
    ].filter(Boolean)

    return {
        locationalClearanceNumber: document.zoning_application_no,
        dateReceived: document.date_of_application,
        applicantName: document.applicant_name,
        corporationName: "",
        applicantAddress: formatDocumentAddress(document),
        corporationAddress: "",
        projectType: projectTypeParts.join(" — ") || "—",
        areaDetails: buildDefaultAreaDetails(document),
        locationDetails: buildDefaultLocationDetails(document),
        projectClassification: document.project_type?.name ?? "—",
        siteZoningClassification: document.zoning?.name ?? "—",
    }
}
