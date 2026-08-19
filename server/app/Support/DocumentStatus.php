<?php

namespace App\Support;

use App\Models\Document;

class DocumentStatus
{
    public const ENCODING = 'encoding';

    public const RETURNED = 'returned';

    public const ENCODED = 'encoded';

    public const INSPECTED = 'inspected';

    public const REVIEWED = 'reviewed';

    public const APPROVED = 'approved';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::ENCODING,
            self::RETURNED,
            self::ENCODED,
            self::INSPECTED,
            self::REVIEWED,
            self::APPROVED,
        ];
    }

    /**
     * Encoder draft statuses that may still be edited/submitted.
     *
     * @return list<string>
     */
    public static function encodingDrafts(): array
    {
        return [
            self::ENCODING,
            self::RETURNED,
        ];
    }

    /**
     * In-progress statuses that can still become overdue.
     *
     * @return list<string>
     */
    public static function overdueEligible(): array
    {
        return [
            self::ENCODED,
            self::INSPECTED,
            self::REVIEWED,
        ];
    }

    /**
     * Map legacy status values to the automated workflow vocabulary.
     */
    public static function migrateLegacy(string $status): string
    {
        return match ($status) {
            'pending' => self::ENCODED,
            'processing' => self::INSPECTED,
            'completed', 'finalized' => self::APPROVED,
            default => $status,
        };
    }

    public static function transition(Document $document, string $status, string $description): void
    {
        $previous = $document->status;

        if ($previous === $status) {
            return;
        }

        $document->update(['status' => $status]);

        ActivityLogger::log(
            'update',
            'documents',
            $document->zoning_application_no,
            $description !== ''
                ? $description
                : "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) from {$previous} to {$status}"
        );
    }
}
