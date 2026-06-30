export const PANABO_LOGO_PATH = "/panabo-logo.jpg"

export function getPanaboLogoUrl(): string {
    if (typeof window !== "undefined") {
        return `${window.location.origin}${PANABO_LOGO_PATH}`
    }

    return PANABO_LOGO_PATH
}
