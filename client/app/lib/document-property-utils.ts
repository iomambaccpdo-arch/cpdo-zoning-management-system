import type { Document, DocumentBuilding, DocumentLot } from "~/api/DocumentService"

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
            area: building.area ?? "",
        }))
    }

    if (document.floor_area) {
        return [{ name: "Building 1", area: document.floor_area }]
    }

    return [emptyBuildingEntry()]
}

export function documentLotsToForm(document: Document): LotFormEntry[] {
    if (document.lots && document.lots.length > 0) {
        return document.lots.map((lot) => ({
            landTitle: lot.land_title ?? "",
            area: lot.area ?? "",
        }))
    }

    if (document.lot_area) {
        return [{ landTitle: "N/A", area: document.lot_area }]
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
        formData.append(`buildings[${index}][area]`, building.area)
    })

    lots.forEach((lot, index) => {
        formData.append(`lots[${index}][land_title]`, lot.landTitle)
        formData.append(`lots[${index}][area]`, lot.area)
    })
}

export function formatBuildingAreaLine(building: DocumentBuilding, index: number): string {
    const number = index + 1
    const name = building.name?.trim() || `Building ${number}`
    const area = building.area?.trim() ? `${building.area.trim()} SQ.M AS PER PLAN` : "—"
    return `Building ${number}: ${name} — ${area}`
}

export function formatLotAreaLine(lot: DocumentLot, index: number): string {
    const number = index + 1
    const title = lot.land_title?.trim() || `Lot ${number}`
    const area = lot.area?.trim() ? `${lot.area.trim()} SQ.M` : "—"
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

    const lotLine = document.lot_area ? `Lot: ${document.lot_area} SQ.M` : null
    const bldgLine = document.floor_area
        ? `Bldg: ${document.floor_area} SQ.M AS PER PLAN`
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
                const area = building.area?.trim()
                    ? `${building.area.trim()} SQUARE METERS`
                    : "—"
                return `${name}: ${area}`
            })
            .join("; ")
    }

    return document.floor_area ? `${document.floor_area} SQUARE METERS` : "—"
}

export function formatLotAreaForClearance(document: Document): string {
    const lots = document.lots ?? []

    if (lots.length > 0) {
        return lots
            .map((lot, index) => {
                const number = index + 1
                const title = lot.land_title?.trim() || `Lot ${number}`
                const area = lot.area?.trim() ? `${lot.area.trim()} SQUARE METERS` : "—"
                return `${title}: ${area}`
            })
            .join("; ")
    }

    return document.lot_area ? `${document.lot_area} SQUARE METERS` : "—"
}
