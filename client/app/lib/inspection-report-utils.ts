import type { Document, DocumentBuilding, DocumentLot, FieldVerificationEntry } from "~/api/DocumentService"
import type { ProjectType, SpecificProjectType, Zoning } from "~/api/ZoningService"
import {
    deduplicatePurokPrefix,
    formatDocumentAreaDetails,
    formatDocumentLocationDetails,
    formatPurokName,
} from "~/lib/document-property-utils"
import { displayZoningClassificationName } from "~/lib/zoning-utils"
import { stripLengthUnit } from "~/lib/measurement-utils"

export interface EncodedProjectType {
    zoningId: number | null
    projectTypeId: number | null
    specificProjectTypeId: number | null
    zoningName: string
    projectTypeName: string
    specificProjectTypeName: string
    label: string
}

export interface InspectionReportPrefill {
    locationalClearanceNumber: string
    dateReceived: string
    applicantName: string
    corporationName: string
    applicantAddress: string
    corporationAddress: string
    projectType: string
    encodedProjectType: EncodedProjectType
    areaDetails: string
    locationDetails: string
    coordinates: string
    buildings: DocumentBuilding[]
    lots: DocumentLot[]
    projectClassification: string
    siteZoningClassification: string
}

export type FieldVerificationsMap = Record<string, FieldVerificationEntry>

export const COORDINATES_FIELD_KEY = "coordinates"

export const COORDINATES_VERIFICATION_STATUSES = {
    NOT_YET_VERIFIED: "Not Yet Verified",
    VERIFIED_CORRECT: "Verified – Coordinates Correct",
    VERIFIED_CORRECTED: "Verified – Coordinates Corrected",
} as const

export type CoordinatesVerificationStatus =
    (typeof COORDINATES_VERIFICATION_STATUSES)[keyof typeof COORDINATES_VERIFICATION_STATUSES]

export const PROJECT_TYPE_FIELD_KEY = "project_type"

export const PROJECT_TYPE_SPECIFIC_NA = "N/A"

export const PROJECT_TYPE_VERIFICATION_STATUSES = {
    NOT_YET_VERIFIED: "Not Yet Verified",
    VERIFIED_CORRECT: "Verified – Correct",
    VERIFIED_CORRECTED: "Verified – Corrected",
} as const

export type ProjectTypeVerificationStatus =
    (typeof PROJECT_TYPE_VERIFICATION_STATUSES)[keyof typeof PROJECT_TYPE_VERIFICATION_STATUSES]

export const STATIC_VERIFIABLE_FIELD_KEYS = [
    "applicant_name",
    "corporation_name",
    "applicant_address",
    "corporation_address",
    "project_type",
    "location",
    COORDINATES_FIELD_KEY,
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

/** Standard road right-of-way (RROW) widths, stored as numeric meters */
export const STANDARD_RROW_OPTIONS = [
    "60",
    "30",
    "20",
    "15",
    "12",
    "10",
    "8",
    "6.5",
    "6",
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
                standardRrow: stripLengthUnit(entry.standardRrow ?? entry.standard_rrow),
                actualRrow: stripLengthUnit(entry.actualRrow ?? entry.actual_rrow),
                minSetback: stripLengthUnit(entry.minSetback ?? entry.min_setback),
                asPerPlan: stripLengthUnit(entry.asPerPlan ?? entry.as_per_plan),
                frontage: stripLengthUnit(entry.frontage),
                remarks: entry.remarks?.toString() ?? "",
            }
        })
    }

    if (legacy) {
        const main = emptyFrontageRoad(0)
        main.name = legacy.road_category ?? ""
        main.standardRrow = stripLengthUnit(legacy.road_standard_rrow)
        main.actualRrow = stripLengthUnit(legacy.road_actual_rrow)
        main.minSetback = stripLengthUnit(legacy.road_min_setback)
        main.asPerPlan = stripLengthUnit(legacy.road_as_per_plan)
        main.frontage = stripLengthUnit(legacy.front_setback)
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
        formatPurokName(document.purok?.name),
        document.barangay?.name,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ")
}

export function buildDefaultAreaDetails(document: Document): string {
    return formatDocumentAreaDetails(document)
}

export function buildDefaultLocationDetails(document: Document): string {
    return formatDocumentLocationDetails(document)
}

export function buildLocationalClearanceLocation(
    document: Document,
    locationDetails?: string | null,
    landmark?: string | null,
    verifiedCoordinates?: string | null,
): string {
    const coords = verifiedCoordinates?.trim() || document.coordinates?.trim()
    let location = deduplicatePurokPrefix(
        locationDetails?.trim() || buildDefaultLocationDetails(document),
    )
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
    const encodedProjectType = encodedProjectTypeFromDocument(document)

    return {
        locationalClearanceNumber: document.zoning_application_no,
        dateReceived: document.date_of_application,
        applicantName: document.applicant_name,
        corporationName: document.corporation_name?.trim() || "",
        applicantAddress: formatDocumentAddress(document),
        corporationAddress: document.corporation_address?.trim() || "",
        projectType: encodedProjectType.label,
        encodedProjectType,
        areaDetails: buildDefaultAreaDetails(document),
        locationDetails: buildDefaultLocationDetails(document),
        coordinates: document.coordinates?.trim() || "",
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
        keys.map((key) => [key, emptyFieldVerification(key)]),
    )
}

function emptyFieldVerification(key: string): FieldVerificationEntry {
    if (key === PROJECT_TYPE_FIELD_KEY) {
        return {
            verified: false,
            correction: "",
            zoning_id: "",
            project_type_id: "",
            specific_project_type_id: "",
        }
    }

    return { verified: false, correction: "" }
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
            ...(key === PROJECT_TYPE_FIELD_KEY
                ? {
                    zoning_id: idToFormValue(entry.zoning_id),
                    project_type_id: idToFormValue(entry.project_type_id),
                    specific_project_type_id: specificIdToFormValue(entry.specific_project_type_id, entry.project_type_id),
                }
                : {}),
        }
    }

    return normalized
}

export function getFieldVerification(
    verifications: FieldVerificationsMap | null | undefined,
    key: string,
): FieldVerificationEntry {
    return verifications?.[key] ?? emptyFieldVerification(key)
}

export function resolvedVerifiedValue(
    encodedValue: string,
    verifications: FieldVerificationsMap | null | undefined,
    key: string,
    zonings?: Zoning[],
): string {
    if (key === PROJECT_TYPE_FIELD_KEY) {
        return resolveVerifiedProjectType(encodedValue, verifications, zonings)
    }

    const entry = getFieldVerification(verifications, key)
    if (entry.verified) {
        return encodedValue
    }

    const correction = entry.correction?.trim()
    return correction || encodedValue
}

export function hydrateCoordinatesVerification(
    keys: string[],
    existing?: Record<string, Partial<FieldVerificationEntry> | null> | null,
    encoded?: string | null,
    gpsCoordinates?: string | null,
): FieldVerificationsMap {
    const normalized = normalizeFieldVerifications(keys, existing)
    const current = getFieldVerification(normalized, COORDINATES_FIELD_KEY)

    if (current.verified || current.correction.trim()) {
        return normalized
    }

    const gps = gpsCoordinates?.trim() ?? ""
    const encodedTrim = encoded?.trim() ?? ""

    if (gps && encodedTrim && gps !== encodedTrim) {
        normalized[COORDINATES_FIELD_KEY] = {
            verified: false,
            correction: gps,
        }
    }

    return normalized
}

export function getCoordinatesVerificationStatus(
    encoded?: string | null,
    verifications?: FieldVerificationsMap | null,
    gpsCoordinates?: string | null,
): CoordinatesVerificationStatus {
    const entry = getFieldVerification(verifications, COORDINATES_FIELD_KEY)

    if (entry.verified) {
        return COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECT
    }

    if (entry.correction?.trim()) {
        return COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECTED
    }

    const gps = gpsCoordinates?.trim() ?? ""
    const encodedTrim = encoded?.trim() ?? ""

    if (gps && encodedTrim && gps !== encodedTrim) {
        return COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECTED
    }

    return COORDINATES_VERIFICATION_STATUSES.NOT_YET_VERIFIED
}

export function resolveVerifiedCoordinates(
    encoded?: string | null,
    verifications?: FieldVerificationsMap | null,
    gpsCoordinates?: string | null,
): string {
    const entry = getFieldVerification(verifications, COORDINATES_FIELD_KEY)

    if (entry.verified) {
        return encoded?.trim() || ""
    }

    const correction = entry.correction?.trim()
    if (correction) {
        return correction
    }

    return gpsCoordinates?.trim() || encoded?.trim() || ""
}

export function verifiedCoordinatesForSave(
    encoded?: string | null,
    verifications?: FieldVerificationsMap | null,
): string {
    const entry = getFieldVerification(verifications, COORDINATES_FIELD_KEY)

    if (entry.verified) {
        return encoded?.trim() || ""
    }

    return entry.correction?.trim() || ""
}

export function encodedProjectTypeFromDocument(document: Document): EncodedProjectType {
    const specificName = document.specific_project_type?.name?.trim() || ""

    return {
        zoningId: document.zoning_id ?? document.zoning?.id ?? null,
        projectTypeId: document.project_type_id ?? document.project_type?.id ?? null,
        specificProjectTypeId: document.specific_project_type_id ?? document.specific_project_type?.id ?? null,
        zoningName: displayZoningClassificationName(document.zoning?.name),
        projectTypeName: document.project_type?.name?.trim() || "—",
        specificProjectTypeName: specificName || PROJECT_TYPE_SPECIFIC_NA,
        label: formatProjectTypeLabel(document.project_type?.name, specificName),
    }
}

export function formatProjectTypeLabel(
    projectTypeName?: string | null,
    specificProjectTypeName?: string | null,
): string {
    const parts = [projectTypeName, specificProjectTypeName]
        .map((part) => part?.trim() ?? "")
        .filter((part) => part !== "" && part.toUpperCase() !== PROJECT_TYPE_SPECIFIC_NA)

    return parts.join(" — ") || "—"
}

export function formatClearanceProjectTypeLabel(
    zoningName?: string | null,
    projectTypeName?: string | null,
    specificProjectTypeName?: string | null,
): string {
    const lines: string[] = []
    const zoning = formatZoningClassificationName(zoningName)
    const projectType = projectTypeName?.trim() ?? ""
    const specific = specificProjectTypeName?.trim() ?? ""

    if (zoning && zoning !== "—") {
        lines.push(zoning)
    }

    if (projectType && projectType !== "—" && projectType.toUpperCase() !== PROJECT_TYPE_SPECIFIC_NA) {
        lines.push(projectType)
    }

    if (specific && specific.toUpperCase() !== PROJECT_TYPE_SPECIFIC_NA) {
        lines.push(`Specific Project Type: ${specific}`)
    }

    return lines.join("\n") || "—"
}

export function projectTypesForZoning(
    zonings: Zoning[] | undefined,
    zoningId: string | number | null | undefined,
): ProjectType[] {
    if (!zonings || zoningId === null || zoningId === undefined || zoningId === "") {
        return []
    }

    return zonings.find((zoning) => zoning.id.toString() === zoningId.toString())?.project_types ?? []
}

export function specificProjectTypesForProjectType(
    projectTypes: ProjectType[],
    projectTypeId: string | number | null | undefined,
): SpecificProjectType[] {
    if (projectTypeId === null || projectTypeId === undefined || projectTypeId === "") {
        return []
    }

    return projectTypes.find((projectType) => projectType.id.toString() === projectTypeId.toString())
        ?.specific_project_types ?? []
}

export function projectTypeLabelFromSelection(
    zonings: Zoning[] | undefined,
    zoningId?: string | number | null,
    projectTypeId?: string | number | null,
    specificProjectTypeId?: string | number | null,
): string {
    const names = projectTypeNamesFromSelection(zonings, zoningId, projectTypeId, specificProjectTypeId)

    return formatProjectTypeLabel(names.projectTypeName, names.specificProjectTypeName)
}

export function clearanceProjectTypeLabelFromSelection(
    zonings: Zoning[] | undefined,
    zoningId?: string | number | null,
    projectTypeId?: string | number | null,
    specificProjectTypeId?: string | number | null,
): string {
    const names = projectTypeNamesFromSelection(zonings, zoningId, projectTypeId, specificProjectTypeId)

    if (!names.zoningName && !names.projectTypeName) {
        return "—"
    }

    return formatClearanceProjectTypeLabel(
        names.zoningName,
        names.projectTypeName,
        names.specificProjectTypeName,
    )
}

function projectTypeNamesFromSelection(
    zonings: Zoning[] | undefined,
    zoningId?: string | number | null,
    projectTypeId?: string | number | null,
    specificProjectTypeId?: string | number | null,
): {
    zoningName?: string
    projectTypeName?: string
    specificProjectTypeName?: string
} {
    if (!zonings || zoningId === null || zoningId === undefined || zoningId === "") {
        return {}
    }

    const zoning = zonings.find((item) => item.id.toString() === String(zoningId))
    const projectTypes = zoning?.project_types ?? []
    const projectType = projectTypes.find((item) => item.id.toString() === String(projectTypeId ?? ""))
    const specificTypes = projectType?.specific_project_types ?? []
    const specific = specificTypes.find((item) => item.id.toString() === String(specificProjectTypeId ?? ""))

    return {
        zoningName: zoning?.name,
        projectTypeName: projectType?.name,
        specificProjectTypeName: specific?.name,
    }
}

export function hasCompleteProjectTypeSelection(entry: FieldVerificationEntry): boolean {
    const zoningId = idToFormValue(entry.zoning_id)
    const projectTypeId = idToFormValue(entry.project_type_id)
    const specificId = entry.specific_project_type_id

    return Boolean(zoningId) && Boolean(projectTypeId) && specificId !== null && specificId !== undefined && String(specificId) !== ""
}

export function projectTypeSelectionMatchesEncoded(
    encoded: EncodedProjectType,
    entry: FieldVerificationEntry,
): boolean {
    return idToFormValue(entry.zoning_id) === idToFormValue(encoded.zoningId)
        && idToFormValue(entry.project_type_id) === idToFormValue(encoded.projectTypeId)
        && specificIdToFormValue(entry.specific_project_type_id, entry.project_type_id)
            === specificIdToFormValue(encoded.specificProjectTypeId, encoded.projectTypeId)
}

export function getProjectTypeVerificationStatus(
    encoded: EncodedProjectType,
    verifications?: FieldVerificationsMap | null,
): ProjectTypeVerificationStatus {
    const entry = getFieldVerification(verifications, PROJECT_TYPE_FIELD_KEY)

    if (entry.verified) {
        return PROJECT_TYPE_VERIFICATION_STATUSES.VERIFIED_CORRECT
    }

    if (hasCompleteProjectTypeSelection(entry)) {
        return projectTypeSelectionMatchesEncoded(encoded, entry)
            ? PROJECT_TYPE_VERIFICATION_STATUSES.VERIFIED_CORRECT
            : PROJECT_TYPE_VERIFICATION_STATUSES.VERIFIED_CORRECTED
    }

    if (entry.correction?.trim()) {
        return PROJECT_TYPE_VERIFICATION_STATUSES.VERIFIED_CORRECTED
    }

    return PROJECT_TYPE_VERIFICATION_STATUSES.NOT_YET_VERIFIED
}

export function resolveVerifiedProjectType(
    encodedLabel: string,
    verifications?: FieldVerificationsMap | null,
    zonings?: Zoning[],
): string {
    const entry = getFieldVerification(verifications, PROJECT_TYPE_FIELD_KEY)

    if (entry.verified) {
        return encodedLabel
    }

    const fromIds = projectTypeLabelFromSelection(
        zonings,
        entry.zoning_id,
        entry.project_type_id,
        entry.specific_project_type_id,
    )
    if (fromIds !== "—") {
        return fromIds
    }

    const correction = entry.correction?.trim()
    return correction || encodedLabel
}

export function resolveVerifiedClearanceProjectType(
    encoded: EncodedProjectType,
    verifications?: FieldVerificationsMap | null,
    zonings?: Zoning[],
): string {
    const encodedLabel = formatClearanceProjectTypeLabel(
        encoded.zoningName,
        encoded.projectTypeName,
        encoded.specificProjectTypeName,
    )
    const entry = getFieldVerification(verifications, PROJECT_TYPE_FIELD_KEY)

    if (entry.verified) {
        return encodedLabel
    }

    const fromIds = clearanceProjectTypeLabelFromSelection(
        zonings,
        entry.zoning_id,
        entry.project_type_id,
        entry.specific_project_type_id,
    )
    if (fromIds !== "—") {
        return fromIds
    }

    if (hasCompleteProjectTypeSelection(entry) && projectTypeSelectionMatchesEncoded(encoded, entry)) {
        return encodedLabel
    }

    const correction = entry.correction?.trim()
    return correction || encodedLabel
}

export function serializeProjectTypeVerification(
    verifications?: FieldVerificationsMap,
): FieldVerificationsMap | undefined {
    if (!verifications) {
        return verifications
    }

    const entry = verifications[PROJECT_TYPE_FIELD_KEY]
    if (!entry) {
        return verifications
    }

    return {
        ...verifications,
        [PROJECT_TYPE_FIELD_KEY]: {
            ...entry,
            zoning_id: numericIdOrNull(entry.zoning_id),
            project_type_id: numericIdOrNull(entry.project_type_id),
            specific_project_type_id: entry.specific_project_type_id === PROJECT_TYPE_SPECIFIC_NA
                ? null
                : numericIdOrNull(entry.specific_project_type_id),
        },
    }
}

function numericIdOrNull(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
        return null
    }

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function idToFormValue(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") {
        return ""
    }

    return String(value)
}

function specificIdToFormValue(
    value: number | string | null | undefined,
    projectTypeId?: number | string | null,
): string {
    if (value === PROJECT_TYPE_SPECIFIC_NA) {
        return PROJECT_TYPE_SPECIFIC_NA
    }

    const formValue = idToFormValue(value)
    if (formValue) {
        return formValue
    }

    return projectTypeId ? PROJECT_TYPE_SPECIFIC_NA : ""
}

export const INSPECTION_RECOMMENDATIONS = {
    NON_CONFORMING: "Non-Conforming — For Notice of Non-Conformance",
    NON_COMPLIANT: "Non-Compliant — For Notice of Deficiency",
    APPROVED: "Approved",
} as const

export type InspectionRecommendationValue =
    (typeof INSPECTION_RECOMMENDATIONS)[keyof typeof INSPECTION_RECOMMENDATIONS]

export const INSPECTION_FINDINGS = {
    ZONING_NON_CONFORMING: "Project Zoning Does Not Conform to Site Zoning",
    SETBACK_DOES_NOT_COMPLY: "Setback Does Not Comply",
    RROW_DISTANCE_DOES_NOT_COMPLY: "Distance from Centerline of the Road Does Not Comply",
    PARKING_REQUIREMENT_NOT_MET: "Parking Requirement Not Met",
    GEOGRAPHIC_COORDINATES_NEED_VERIFICATION: "Geographic Coordinates Need Verification",
    CORRECTED_SITE_PLAN_REQUIRED: "Corrected Site Plan Required",
    INSPECTION_PHOTOS_REQUIRED: "Inspection Photos Required",
    MISSING_BARANGAY_CLEARANCE: "Missing Barangay Clearance",
    ADDITIONAL_DOCUMENT_REQUIRED: "Additional Document Required",
} as const

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
    fieldVerifications?: FieldVerificationsMap | null
    coordinatesNeedVerification?: boolean
}

const SITE_PLAN_FIELD_KEY_PATTERN =
    /^(project_type|location|area_details|building_\d+_(name|area)|lot_\d+_(land_title|area))$/

const GENERIC_LACKING_DOCUMENT_PATTERN =
    /^(additional\s+documents?(\s+required)?|documents?\s+required|yes|needed|lacking|required)$/i

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

export function collectInspectionFindings(input: InspectionRecommendationInput): string[] {
    const items: string[] = []

    const project = (input.projectZoningClassification ?? "").trim().toLowerCase()
    const site = (input.siteZoningClassification ?? "").trim().toLowerCase()

    if (project && site && project !== site) {
        items.push(INSPECTION_FINDINGS.ZONING_NON_CONFORMING)
    }

    if (hasSetbackDeficiency(input.frontages)) {
        items.push(INSPECTION_FINDINGS.SETBACK_DOES_NOT_COMPLY)
    }

    if (hasRrowDistanceDeficiency(input.frontages, input.distanceCenterLineToBuilding)) {
        items.push(INSPECTION_FINDINGS.RROW_DISTANCE_DOES_NOT_COMPLY)
    }

    if (hasParkingDeficiency(input.parkingSpaceRequirement, input.parkingAsPerPlan)) {
        items.push(INSPECTION_FINDINGS.PARKING_REQUIREMENT_NOT_MET)
    }

    if (input.coordinatesNeedVerification) {
        items.push(INSPECTION_FINDINGS.GEOGRAPHIC_COORDINATES_NEED_VERIFICATION)
    }

    if (hasCorrectedSitePlan(input.fieldVerifications)) {
        items.push(INSPECTION_FINDINGS.CORRECTED_SITE_PLAN_REQUIRED)
    }

    if (!input.hasInspectionPhotos) {
        items.push(INSPECTION_FINDINGS.INSPECTION_PHOTOS_REQUIRED)
    }

    for (const item of lackingDocumentItems(input.lackingDocuments)) {
        if (!items.includes(item)) {
            items.push(item)
        }
    }

    return items
}

export function evaluateInspectionRecommendation(input: InspectionRecommendationInput): {
    recommendation: InspectionRecommendationValue
    findings: string[]
} {
    return {
        recommendation: determineInspectionRecommendation(input),
        findings: collectInspectionFindings(input),
    }
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

function hasCorrectedSitePlan(verifications?: FieldVerificationsMap | null): boolean {
    if (!verifications) {
        return false
    }

    return Object.entries(verifications).some(([key, entry]) => {
        if (!SITE_PLAN_FIELD_KEY_PATTERN.test(key)) {
            return false
        }

        return !entry.verified && (
            Boolean(entry.correction?.trim())
            || (key === PROJECT_TYPE_FIELD_KEY && (
                Boolean(idToFormValue(entry.zoning_id))
                || Boolean(idToFormValue(entry.project_type_id))
            ))
        )
    })
}

function lackingDocumentItems(value?: string | null): string[] {
    if (!hasLackingDocuments(value)) {
        return []
    }

    const items: string[] = []

    for (const part of value!.split(/[\n;]+|,/)) {
        const trimmed = part.trim()
        if (!trimmed) {
            continue
        }

        const canonical = canonicalizeLackingDocumentItem(trimmed)
        if (!items.includes(canonical)) {
            items.push(canonical)
        }
    }

    return items.length > 0 ? items : [INSPECTION_FINDINGS.ADDITIONAL_DOCUMENT_REQUIRED]
}

function canonicalizeLackingDocumentItem(item: string): string {
    const lower = item.toLowerCase()

    if (lower.includes("barangay")) {
        return INSPECTION_FINDINGS.MISSING_BARANGAY_CLEARANCE
    }

    if (lower.includes("site plan")) {
        return INSPECTION_FINDINGS.CORRECTED_SITE_PLAN_REQUIRED
    }

    if (GENERIC_LACKING_DOCUMENT_PATTERN.test(item)) {
        return INSPECTION_FINDINGS.ADDITIONAL_DOCUMENT_REQUIRED
    }

    return item
}
