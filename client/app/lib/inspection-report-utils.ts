import type { Document, DocumentBuilding, DocumentLot, FieldVerificationEntry } from "~/api/DocumentService"
import { formatDocumentAreaDetails } from "~/lib/document-property-utils"
import { displayZoningClassificationName } from "~/lib/zoning-utils"

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
    buildings: DocumentBuilding[]
    lots: DocumentLot[]
    projectClassification: string
    siteZoningClassification: string
}

export type FieldVerificationsMap = Record<string, FieldVerificationEntry>

export const STATIC_VERIFIABLE_FIELD_KEYS = [
    "applicant_name",
    "corporation_name",
    "applicant_address",
    "corporation_address",
    "project_type",
    "location",
    "project_classification",
    "site_zoning_classification",
] as const

export const DEFAULT_PARKING_BUILDING_CODE = "ONE (1) CAR SLOT FOR EVERY UNIT"

export const PARKING_SPACE_VEHICLE_TYPES = [
    { key: "car", label: "CAR" },
    { key: "bus", label: "BUS" },
    { key: "articulated_vehicle", label: "Articulated Vehicle" },
    { key: "standard_truck", label: "Standard Truck" },
    { key: "jeepney_shuttle", label: "Jeepney/Shuttle" },
] as const

export type ParkingSpaceVehicleKey = (typeof PARKING_SPACE_VEHICLE_TYPES)[number]["key"]

export type ParkingSpaceRequirementMap = Record<ParkingSpaceVehicleKey, string>

export function emptyParkingSpaceRequirement(): ParkingSpaceRequirementMap {
    return {
        car: "",
        bus: "",
        articulated_vehicle: "",
        standard_truck: "",
        jeepney_shuttle: "",
    }
}

export function normalizeParkingSpaceRequirement(
    value?: Partial<Record<string, string | null>> | string | null,
): ParkingSpaceRequirementMap {
    const normalized = emptyParkingSpaceRequirement()

    if (!value || typeof value === "string") {
        return normalized
    }

    for (const { key } of PARKING_SPACE_VEHICLE_TYPES) {
        normalized[key] = value[key]?.toString() ?? ""
    }

    return normalized
}

export function formatParkingSpaceRequirement(
    value?: Partial<Record<string, string | null>> | string | null,
): string {
    if (typeof value === "string") {
        return value.trim()
    }

    const normalized = normalizeParkingSpaceRequirement(value)
    const parts = PARKING_SPACE_VEHICLE_TYPES
        .map(({ key, label }) => {
            const slot = normalized[key].trim()
            return slot ? `${label}: ${slot}` : null
        })
        .filter(Boolean)

    return parts.join("; ")
}

/** Percentage-based project status as of inspection date */
export const PROJECT_STATUS_OPTIONS = [
    "Completed (100%)",
    "Ongoing (76–99%)",
    "Ongoing (51–75%)",
    "Ongoing (26–50%)",
    "Ongoing (1–25%)",
    "No Construction (0%)",
] as const

export type ProjectStatusOption = (typeof PROJECT_STATUS_OPTIONS)[number]

/** Standard road right-of-way (RROW) widths */
export const STANDARD_RROW_OPTIONS = [
    "60 Meters",
    "30 Meters",
    "20 Meters",
    "15 Meters",
    "12 Meters",
    "10 Meters",
    "8 Meters",
    "6.5 Meters",
    "6 Meters",
] as const

export type StandardRrowOption = (typeof STANDARD_RROW_OPTIONS)[number]

/** Frontage road slots: Main Road is always required; others are optional. */
export const FRONTAGE_ROAD_OPTIONS = [
    { key: "main", label: "Main Road" },
    { key: "second", label: "2nd Road" },
    { key: "third", label: "3rd Road" },
    { key: "fourth", label: "4th Road" },
] as const

export type FrontageRoadKey = (typeof FRONTAGE_ROAD_OPTIONS)[number]["key"]

export type FrontageRoadEntry = {
    key: FrontageRoadKey
    label: string
    name: string
    standardRrow: string
    actualRrow: string
    minSetback: string
    asPerPlan: string
    frontage: string
    remarks: string
}

export function emptyFrontageRoad(index = 0): FrontageRoadEntry {
    const option = FRONTAGE_ROAD_OPTIONS[Math.min(index, FRONTAGE_ROAD_OPTIONS.length - 1)]

    return {
        key: option.key,
        label: option.label,
        name: "",
        standardRrow: "",
        actualRrow: "",
        minSetback: "",
        asPerPlan: "",
        frontage: "",
        remarks: "",
    }
}

export function defaultFrontages(): FrontageRoadEntry[] {
    return [emptyFrontageRoad(0)]
}

export function nextFrontageRoadLabel(count: number): string | null {
    if (count >= FRONTAGE_ROAD_OPTIONS.length) {
        return null
    }

    return FRONTAGE_ROAD_OPTIONS[count].label
}

export function normalizeFrontages(
    value?: Array<Partial<FrontageRoadEntry> & {
        standard_rrow?: string | null
        actual_rrow?: string | null
        min_setback?: string | null
        as_per_plan?: string | null
    }> | null,
    legacy?: {
        road_category?: string | null
        road_standard_rrow?: string | null
        road_actual_rrow?: string | null
        road_min_setback?: string | null
        road_as_per_plan?: string | null
        road_remarks?: string | null
        front_setback?: string | null
    },
): FrontageRoadEntry[] {
    if (Array.isArray(value) && value.length > 0) {
        return value.slice(0, FRONTAGE_ROAD_OPTIONS.length).map((entry, index) => {
            const option = FRONTAGE_ROAD_OPTIONS[index]

            return {
                key: option.key,
                label: option.label,
                name: entry.name?.toString() ?? "",
                standardRrow: (entry.standardRrow ?? entry.standard_rrow)?.toString() ?? "",
                actualRrow: (entry.actualRrow ?? entry.actual_rrow)?.toString() ?? "",
                minSetback: (entry.minSetback ?? entry.min_setback)?.toString() ?? "",
                asPerPlan: (entry.asPerPlan ?? entry.as_per_plan)?.toString() ?? "",
                frontage: entry.frontage?.toString() ?? "",
                remarks: entry.remarks?.toString() ?? "",
            }
        })
    }

    if (legacy) {
        const main = emptyFrontageRoad(0)
        main.name = legacy.road_category ?? ""
        main.standardRrow = legacy.road_standard_rrow ?? ""
        main.actualRrow = legacy.road_actual_rrow ?? ""
        main.minSetback = legacy.road_min_setback ?? ""
        main.asPerPlan = legacy.road_as_per_plan ?? ""
        main.frontage = legacy.front_setback ?? ""
        main.remarks = legacy.road_remarks ?? ""

        const hasLegacy = [
            main.name,
            main.standardRrow,
            main.actualRrow,
            main.minSetback,
            main.asPerPlan,
            main.frontage,
            main.remarks,
        ].some((part) => part.trim() !== "")

        if (hasLegacy) {
            return [main]
        }
    }

    return defaultFrontages()
}

/** Locational clearance type of lot options */
export const TYPE_OF_LOT_OPTIONS = [
    "Interior Lot",
    "Inside Lot",
    "Corner Lot",
    "Through Lot",
    "Corner Through Lot",
    "End Lot",
] as const

export type TypeOfLotOption = (typeof TYPE_OF_LOT_OPTIONS)[number]

/** Right over land document/authority options */
export const RIGHT_OVER_LAND_OPTIONS = [
    "Land Title",
    "Deed of Sale",
    "Extra Judicial Settlement of Estate",
    "Deed of Donation",
    "Affidavit of Consent",
    "Lease, Usufruct & Other Agreement",
    "Certificate of Land Ownership",
] as const

export type RightOverLandOption = (typeof RIGHT_OVER_LAND_OPTIONS)[number]

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
    return formatDocumentAreaDetails(document)
}

export function buildDefaultLocationDetails(document: Document): string {
    const parts = [
        document.purok?.name ? `Purok ${document.purok.name}` : null,
        document.barangay?.name ? `Brgy. ${document.barangay.name}` : null,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ")
}

export function buildLocationalClearanceLocation(
    document: Document,
    locationDetails?: string | null,
    landmark?: string | null,
): string {
    const coords = document.coordinates?.trim()
    let location = locationDetails?.trim() || buildDefaultLocationDetails(document)
    const landmarkText = landmark?.trim()

    if (landmarkText) {
        location = `${location} — ${landmarkText}`
    }

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
        corporationName: document.corporation_name?.trim() || "",
        applicantAddress: formatDocumentAddress(document),
        corporationAddress: document.corporation_address?.trim() || "",
        projectType: projectTypeParts.join(" — ") || "—",
        areaDetails: buildDefaultAreaDetails(document),
        locationDetails: buildDefaultLocationDetails(document),
        buildings: document.buildings ?? [],
        lots: document.lots ?? [],
        projectClassification: displayZoningClassificationName(document.zoning?.name),
        siteZoningClassification: displayZoningClassificationName(document.zoning?.name),
    }
}

export function buildVerifiableFieldKeys(prefill: InspectionReportPrefill): string[] {
    const keys: string[] = [...STATIC_VERIFIABLE_FIELD_KEYS]

    if (prefill.buildings.length > 0 || prefill.lots.length > 0) {
        prefill.buildings.forEach((_, index) => {
            keys.push(`building_${index}_name`, `building_${index}_area`)
        })
        prefill.lots.forEach((_, index) => {
            keys.push(`lot_${index}_land_title`, `lot_${index}_area`)
        })
    } else {
        keys.push("area_details")
    }

    return keys
}

export function emptyFieldVerifications(keys: string[]): FieldVerificationsMap {
    return Object.fromEntries(
        keys.map((key) => [key, { verified: false, correction: "" }]),
    )
}

export function normalizeFieldVerifications(
    keys: string[],
    existing?: Record<string, Partial<FieldVerificationEntry> | null> | null,
): FieldVerificationsMap {
    const normalized = emptyFieldVerifications(keys)

    if (!existing) {
        return normalized
    }

    for (const key of keys) {
        const entry = existing[key]
        if (!entry) {
            continue
        }

        normalized[key] = {
            verified: Boolean(entry.verified),
            correction: entry.correction?.toString() ?? "",
        }
    }

    return normalized
}

export function getFieldVerification(
    verifications: FieldVerificationsMap | null | undefined,
    key: string,
): FieldVerificationEntry {
    return verifications?.[key] ?? { verified: false, correction: "" }
}

export function resolvedVerifiedValue(
    encodedValue: string,
    verifications: FieldVerificationsMap | null | undefined,
    key: string,
): string {
    const entry = getFieldVerification(verifications, key)
    if (entry.verified) {
        return encodedValue
    }

    const correction = entry.correction?.trim()
    return correction || encodedValue
}

export const INSPECTION_RECOMMENDATIONS = {
    NON_CONFORMING: "Non-Conforming — For Notice of Non-Conformance",
    NON_COMPLIANT: "Non-Compliant — For Notice of Deficiency",
    APPROVED: "Approved",
} as const

export type InspectionRecommendationValue =
    (typeof INSPECTION_RECOMMENDATIONS)[keyof typeof INSPECTION_RECOMMENDATIONS]

export type InspectionRecommendationInput = {
    projectZoningClassification?: string | null
    siteZoningClassification?: string | null
    projectSignificance?: string | null
    rightOverLand?: string | null
    inspectionDate?: string | null
    projectStatusAsOfInspection?: string | null
    hasInspectionPhotos?: boolean
    abuttingNorth?: string | null
    abuttingEast?: string | null
    abuttingSouth?: string | null
    abuttingWest?: string | null
    frontages?: Array<Partial<FrontageRoadEntry>> | null
    distanceCenterLineToBuilding?: string | null
    parkingSpaceRequirement?: Partial<ParkingSpaceRequirementMap> | null
    parkingAsPerPlan?: Partial<ParkingSpaceRequirementMap> | null
    typeOfLot?: string | null
    lackingDocuments?: string | null
}

function isBlank(value: string | null | undefined): boolean {
    return !value || value.trim() === ""
}

function parseMeterNumber(value: string | null | undefined): number | null {
    if (!value || value.trim() === "") {
        return null
    }

    const match = value.trim().match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : null
}

export function determineInspectionRecommendation(
    input: InspectionRecommendationInput,
): InspectionRecommendationValue {
    const project = (input.projectZoningClassification ?? "").trim().toLowerCase()
    const site = (input.siteZoningClassification ?? "").trim().toLowerCase()

    if (project && site && project !== site) {
        return INSPECTION_RECOMMENDATIONS.NON_CONFORMING
    }

    if (isEvaluationIncomplete(input)
        || hasSetbackDeficiency(input.frontages)
        || hasRrowDistanceDeficiency(input.frontages, input.distanceCenterLineToBuilding)
        || hasParkingDeficiency(input.parkingSpaceRequirement, input.parkingAsPerPlan)
        || hasLackingDocuments(input.lackingDocuments)
    ) {
        return INSPECTION_RECOMMENDATIONS.NON_COMPLIANT
    }

    return INSPECTION_RECOMMENDATIONS.APPROVED
}

function isEvaluationIncomplete(input: InspectionRecommendationInput): boolean {
    const required = [
        input.projectSignificance,
        input.rightOverLand,
        input.inspectionDate,
        input.projectStatusAsOfInspection,
        input.abuttingNorth,
        input.abuttingEast,
        input.abuttingSouth,
        input.abuttingWest,
        input.distanceCenterLineToBuilding,
        input.typeOfLot,
        input.lackingDocuments,
    ]

    if (required.some(isBlank) || !input.hasInspectionPhotos) {
        return true
    }

    const main = input.frontages?.[0]
    if (!main
        || isBlank(main.name)
        || isBlank(main.standardRrow)
        || isBlank(main.actualRrow)
        || isBlank(main.minSetback)
        || isBlank(main.asPerPlan)
    ) {
        return true
    }

    const minimum = normalizeParkingSpaceRequirement(input.parkingSpaceRequirement)
    const asPerPlan = normalizeParkingSpaceRequirement(input.parkingAsPerPlan)
    let hasAnyParking = false

    for (const { key } of PARKING_SPACE_VEHICLE_TYPES) {
        if (minimum[key].trim() || asPerPlan[key].trim()) {
            hasAnyParking = true
        }
        if (minimum[key].trim() && !asPerPlan[key].trim()) {
            return true
        }
    }

    return !hasAnyParking
}

function hasSetbackDeficiency(
    frontages?: Array<Partial<FrontageRoadEntry>> | null,
): boolean {
    if (!frontages?.length) {
        return false
    }

    return frontages.some((road) => {
        const minimum = parseMeterNumber(road.minSetback)
        const asPerPlan = parseMeterNumber(road.asPerPlan)
        return minimum !== null && asPerPlan !== null && minimum > asPerPlan
    })
}

function hasRrowDistanceDeficiency(
    frontages: Array<Partial<FrontageRoadEntry>> | null | undefined,
    distanceCenterLine?: string | null,
): boolean {
    const distance = parseMeterNumber(distanceCenterLine)
    const main = frontages?.[0]
    if (distance === null || !main) {
        return false
    }

    const standard = parseMeterNumber(main.standardRrow)
    const minSetback = parseMeterNumber(main.minSetback)
    if (standard === null || minSetback === null) {
        return false
    }

    return distance < standard / 2 + minSetback
}

function hasParkingDeficiency(
    minimum?: Partial<ParkingSpaceRequirementMap> | null,
    asPerPlan?: Partial<ParkingSpaceRequirementMap> | null,
): boolean {
    const required = normalizeParkingSpaceRequirement(minimum)
    const planned = normalizeParkingSpaceRequirement(asPerPlan)

    return PARKING_SPACE_VEHICLE_TYPES.some(({ key }) => {
        if (!required[key].trim() || !planned[key].trim()) {
            return false
        }
        return Number(planned[key]) < Number(required[key])
    })
}

function hasLackingDocuments(value?: string | null): boolean {
    if (isBlank(value)) {
        return false
    }

    return value!.trim().toUpperCase() !== "N/A"
}
