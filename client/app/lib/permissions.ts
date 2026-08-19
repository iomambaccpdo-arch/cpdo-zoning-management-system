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

export function isEncoderClerk(user: User | null | undefined): boolean {
    return user?.roles?.some((role) => role.name === "Encoder (Clerk)") ?? false
}

export function canCreateFile(user: User | null | undefined): boolean {
    return hasResourcePermission(user, "Files", "create")
}

export function canUpdateFile(user: User | null | undefined): boolean {
    return hasResourcePermission(user, "Files", "update")
}

export function canDeleteFile(user: User | null | undefined): boolean {
    return hasResourcePermission(user, "Files", "delete")
}

export function canSubmitApplication(user: User | null | undefined): boolean {
    return hasResourcePermission(user, "Files", "submit_application")
}

export function canEditDocument(
    user: User | null | undefined,
    status?: string
): boolean {
    if (!canUpdateFile(user)) {
        return false
    }

    if (isEncoderClerk(user)) {
        return status === "encoding" || status === "returned"
    }

    return true
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

export function canReviewInspectionReport(user: User | null | undefined): boolean {
    if (hasResourcePermission(user, "Files", "review_inspection_report")) {
        return true
    }

    return (
        user?.roles?.some(
            (role) =>
                role.name === "Zoning Officer" ||
                role.name === "Coordinator" ||
                role.name === "Super Admin"
        ) ?? false
    )
}

export function canApproveApplication(user: User | null | undefined): boolean {
    if (hasResourcePermission(user, "Files", "approve_application")) {
        return true
    }

    return (
        user?.roles?.some(
            (role) => role.name === "Coordinator" || role.name === "Super Admin"
        ) ?? false
    )
}

export function canReturnToEncoder(user: User | null | undefined): boolean {
    return (
        user?.roles?.some(
            (role) => role.name === "Coordinator" || role.name === "Super Admin"
        ) ?? false
    )
}

export function canReturnInspectionReport(user: User | null | undefined): boolean {
    return (
        user?.roles?.some(
            (role) => role.name === "Coordinator" || role.name === "Super Admin"
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
                role.name === "Zoning Officer" ||
                role.name === "Coordinator" ||
                role.name === "Super Admin"
        ) ?? false
    )
}

export function canViewInspectionReport(user: User | null | undefined): boolean {
    return canManageInspectionReport(user) || canReviewInspectionReport(user)
}
