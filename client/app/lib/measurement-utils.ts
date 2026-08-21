export const AREA_UNIT = "sqm"
export const LENGTH_UNIT = "m"

function trimmedMeasurement(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return ""
    }

    const trimmed = String(value).trim()

    if (!trimmed || trimmed === "—" || trimmed === "-") {
        return ""
    }

    return trimmed
}

export function stripAreaUnit(value: string | number | null | undefined): string {
    const trimmed = trimmedMeasurement(value)

    if (!trimmed) {
        return ""
    }

    return trimmed.replace(/(?:\s*(?:square\s*meters?|sq\.?\s*m\.?|sqm))+$/i, "").trim()
}

export function stripLengthUnit(value: string | number | null | undefined): string {
    const trimmed = trimmedMeasurement(value)

    if (!trimmed) {
        return ""
    }

    return trimmed.replace(/\s*(?:meters?|m)\s*$/i, "").trim()
}

export function formatArea(value: string | number | null | undefined, empty = ""): string {
    const numeric = stripAreaUnit(value)

    return numeric ? `${numeric} ${AREA_UNIT}` : empty
}

export function formatLength(value: string | number | null | undefined, empty = ""): string {
    const numeric = stripLengthUnit(value)

    return numeric ? `${numeric} ${LENGTH_UNIT}` : empty
}
