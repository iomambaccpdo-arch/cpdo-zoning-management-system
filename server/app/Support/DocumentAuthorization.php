<?php

namespace App\Support;

use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class DocumentAuthorization
{
    public const ENCODER_ROLE = 'Encoder (Clerk)';

    public const ENCODING_STATUSES = [
        DocumentStatus::ENCODING,
        DocumentStatus::RETURNED,
    ];

    public const ALL_STATUSES = [
        DocumentStatus::ENCODING,
        DocumentStatus::RETURNED,
        DocumentStatus::ENCODED,
        DocumentStatus::INSPECTED,
        DocumentStatus::REVIEWED,
        DocumentStatus::APPROVED,
    ];

    public static function isEncoder(User $user): bool
    {
        return $user->roles->contains(fn ($role) => $role->name === self::ENCODER_ROLE);
    }

    public static function scopeForUser(Builder $query, User $user): Builder
    {
        if (self::isEncoder($user)) {
            return $query->where('received_by_user_id', $user->id);
        }

        return $query;
    }

    public static function canManageDocument(User $user, Document $document): bool
    {
        if (! self::isEncoder($user)) {
            return true;
        }

        return $document->received_by_user_id === $user->id
            && in_array($document->status, self::ENCODING_STATUSES, true);
    }

    public static function canSubmitDocument(User $user, Document $document): bool
    {
        if (! $user->hasResourcePermission('Files', 'submit_application')) {
            return false;
        }

        if (! self::isEncoder($user)) {
            return false;
        }

        return $document->received_by_user_id === $user->id
            && in_array($document->status, self::ENCODING_STATUSES, true);
    }

    public static function canReviewInspectionReport(User $user, Document $document): bool
    {
        if (! $user->hasResourcePermission('Files', 'review_inspection_report')) {
            return false;
        }

        return $document->status === DocumentStatus::INSPECTED;
    }

    public static function canApproveApplication(User $user, Document $document): bool
    {
        if (! $user->hasResourcePermission('Files', 'approve_application')) {
            return false;
        }

        return $document->status === DocumentStatus::REVIEWED;
    }

    public static function canReturnToEncoder(User $user, Document $document): bool
    {
        if (! $user->roles->contains(
            fn ($role) => in_array($role->name, ['Coordinator', 'Super Admin'], true)
        )) {
            return false;
        }

        return in_array($document->status, [
            DocumentStatus::ENCODING,
            DocumentStatus::ENCODED,
            DocumentStatus::INSPECTED,
            DocumentStatus::REVIEWED,
        ], true);
    }
}
