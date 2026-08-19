export const PANABO_LOGO_PATH = "/panabo-logo.jpg"
export const CPDO_LOGO_PATH = "/cpdo-logo.png"
export const LC_HEADER_PATH = "/lc-header.png"
export const LC_FOOTER_PATH = "/lc-footer.png"

function absoluteAssetUrl(path: string): string {
    if (typeof window !== "undefined") {
        return `${window.location.origin}${path}`
    }

    return path
}

export function getPanaboLogoUrl(): string {
    return absoluteAssetUrl(PANABO_LOGO_PATH)
}

export function getCpdoLogoUrl(): string {
    return absoluteAssetUrl(CPDO_LOGO_PATH)
}

export function getLcHeaderUrl(): string {
    return absoluteAssetUrl(LC_HEADER_PATH)
}

export function getLcFooterUrl(): string {
    return absoluteAssetUrl(LC_FOOTER_PATH)
}
