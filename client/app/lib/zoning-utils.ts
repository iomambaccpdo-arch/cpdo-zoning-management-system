/**
 * Normalize ordinance zoning labels into display classification names.
 *
 * Examples:
 * - "Section 12.11. Regulations in Commercial-1 (C-1) Zone" → "Commercial-1 (C-1) Zone"
 * - "Section 12.16. Regulations in Industrial-3 (1-3) Zone" → "Industrial-3 (I-3) Zone"
 */
export function formatZoningClassificationName(
    name: string | null | undefined,
): string {
    const trimmed = name?.trim() ?? ""

    if (!trimmed) {
        return ""
    }

    let formatted = trimmed.replace(/^Section\s+[\d.]+\s*/i, "")
    formatted = formatted.replace(/^Regulations\s+in\s+/i, "")

    // Ordinance source uses digit "1" instead of letter "I" for Industrial zone codes.
    formatted = formatted.replace(
        /\b(Industrial-\d+)\s+\(1-(\d+)\)/i,
        "$1 (I-$2)",
    )

    return formatted.trim()
}

export function displayZoningClassificationName(
    name: string | null | undefined,
    empty = "—",
): string {
    return formatZoningClassificationName(name) || empty
}
