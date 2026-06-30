import type { User } from "~/store/auth"

export function hasResourcePermission(
    user: User | null | undefined,
    resource: string,
    action: string
): boolean {
    return (
        user?.roles?.some((role) =>
            role.permissions?.some(
                (p) => p.resource === resource && p.name === action
            )
        ) ?? false
    )
}

export function canExtendDueDate(user: User | null | undefined): boolean {
    if (hasResourcePermission(user, "Files", "extend_due_date")) {
        return true
    }

    return (
        user?.roles?.some(
            (role) => role.name === "Coordinator" || role.name === "Super Admin"
        ) ?? false
    )
}

export function canManageInspectionReport(user: User | null | undefined): boolean {
    if (hasResourcePermission(user, "Files", "inspection_report")) {
        return true
    }

    return (
        user?.roles?.some(
            (role) =>
                role.name === "Zoning Inspector" ||
                role.name === "Coordinator" ||
                role.name === "Super Admin"
        ) ?? false
    )
}

export function canGenerateLocationalClearance(user: User | null | undefined): boolean {
    if (hasResourcePermission(user, "Files", "generate_locational_clearance")) {
        return true
    }

    return (
        user?.roles?.some(
            (role) =>
                role.name === "Coordinator" ||
                role.name === "Section Head" ||
                role.name === "Super Admin"
        ) ?? false
    )
}
