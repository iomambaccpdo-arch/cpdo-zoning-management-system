import type { Document, DocumentBuilding, DocumentLot } from "~/api/DocumentService"
import { formatArea, stripAreaUnit } from "~/lib/measurement-utils"

export function formatPurokName(name?: string | null): string | null {
    const trimmed = name?.trim() ?? ""

    if (!trimmed) {
        return null
    }

    const remainder = trimmed.replace(/^(?:(?:purok|prk\.?)\s+)+/i, "").trim()

    if (!remainder) {
        return "Purok"
    }

    return `Purok ${remainder}`
}

export function deduplicatePurokPrefix(location: string): string {
    return location.replace(/\b(?:(?:purok|prk\.?)\s+)+/gi, "Purok ")
}

export function formatDocumentLocationDetails(document: Pick<Document, "purok" | "barangay">): string {
    const parts = [
        formatPurokName(document.purok?.name),
        document.barangay?.name ? `Brgy. ${document.barangay.name}` : null,
        "Panabo City",
    ].filter(Boolean)

    return parts.join(", ")
}

export type BuildingFormEntry = {
    name: string
    area: string
}

export type LotFormEntry = {
    landTitle: string
    area: string
}

export function emptyBuildingEntry(): BuildingFormEntry {
    return { name: "", area: "" }
}

export function emptyLotEntry(): LotFormEntry {
    return { landTitle: "", area: "" }
}

export function documentBuildingsToForm(document: Document): BuildingFormEntry[] {
    if (document.buildings && document.buildings.length > 0) {
        return document.buildings.map((building) => ({
            name: building.name ?? "",
            area: stripAreaUnit(building.area),
        }))
    }

    if (document.floor_area) {
        return [{ name: "Building 1", area: stripAreaUnit(document.floor_area) }]
    }

    return [emptyBuildingEntry()]
}

export function documentLotsToForm(document: Document): LotFormEntry[] {
    if (document.lots && document.lots.length > 0) {
        return document.lots.map((lot) => ({
            landTitle: lot.land_title ?? "",
            area: stripAreaUnit(lot.area),
        }))
    }

    if (document.lot_area) {
        return [{ landTitle: "N/A", area: stripAreaUnit(document.lot_area) }]
    }

    return [emptyLotEntry()]
}

export function appendBuildingsAndLotsToFormData(
    formData: FormData,
    buildings: BuildingFormEntry[],
    lots: LotFormEntry[],
) {
    buildings.forEach((building, index) => {
        formData.append(`buildings[${index}][name]`, building.name)
        formData.append(`buildings[${index}][area]`, stripAreaUnit(building.area))
    })

    lots.forEach((lot, index) => {
        formData.append(`lots[${index}][land_title]`, lot.landTitle)
        formData.append(`lots[${index}][area]`, stripAreaUnit(lot.area))
    })
}

export function formatBuildingAreaLine(building: DocumentBuilding, index: number): string {
    const number = index + 1
    const name = building.name?.trim() || `Building ${number}`
    const area = formatArea(building.area)
    const areaLabel = area ? `${area} AS PER PLAN` : "—"
    return `Building ${number}: ${name} — ${areaLabel}`
}

export function formatLotAreaLine(lot: DocumentLot, index: number): string {
    const number = index + 1
    const title = lot.land_title?.trim() || `Lot ${number}`
    const area = formatArea(lot.area, "—")
    return `Lot ${number}: ${title} — ${area}`
}

export function formatDocumentAreaDetails(document: Document): string {
    const lines: string[] = []

    const buildings = document.buildings ?? []
    const lots = document.lots ?? []

    buildings.forEach((building, index) => {
        lines.push(formatBuildingAreaLine(building, index))
    })

    lots.forEach((lot, index) => {
        lines.push(formatLotAreaLine(lot, index))
    })

    if (lines.length > 0) {
        return lines.join("\n")
    }

    const lotLine = document.lot_area ? `Lot: ${formatArea(document.lot_area, "—")}` : null
    const bldgLine = document.floor_area
        ? `Bldg: ${formatArea(document.floor_area)} AS PER PLAN`
        : null

    return [lotLine, bldgLine].filter(Boolean).join("\n")
}

export function formatFloorAreaForClearance(document: Document): string {
    const buildings = document.buildings ?? []

    if (buildings.length > 0) {
        return buildings
            .map((building, index) => {
                const number = index + 1
                const name = building.name?.trim() || `Building ${number}`
                const area = formatArea(building.area, "—")
                return `${name}: ${area}`
            })
            .join("; ")
    }

    return formatArea(document.floor_area, "—")
}

export function formatLotAreaForClearance(document: Document): string {
    const lots = document.lots ?? []

    if (lots.length > 0) {
        return lots
            .map((lot, index) => {
                const number = index + 1
                const title = lot.land_title?.trim() || `Lot ${number}`
                const area = formatArea(lot.area, "—")
                return `${title}: ${area}`
            })
            .join("; ")
    }

    return formatArea(document.lot_area, "—")
}
