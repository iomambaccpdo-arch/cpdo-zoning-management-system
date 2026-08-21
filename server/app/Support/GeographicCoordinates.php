<?php

namespace App\Support;

use App\Models\Document;

class GeographicCoordinates
{
    public const FIELD_KEY = 'coordinates';

    public const STATUS_NOT_YET_VERIFIED = 'Not Yet Verified';

    public const STATUS_VERIFIED_CORRECT = 'Verified – Coordinates Correct';

    public const STATUS_VERIFIED_CORRECTED = 'Verified – Coordinates Corrected';

    /**
     * Encoder coordinates are locked after the application leaves encoding.
     */
    public static function encoderCoordinatesLocked(Document $document): bool
    {
        return $document->status !== DocumentStatus::ENCODING;
    }

    /**
     * @param  array<string, mixed>|null  $verifications
     */
    public static function resolved(
        ?string $encoded,
        ?array $verifications,
        ?string $gpsCoordinates = null,
    ): string {
        $encoded = trim((string) $encoded);
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (is_array($entry)) {
            if (($entry['verified'] ?? false) === true) {
                return $encoded;
            }

            $correction = trim((string) ($entry['correction'] ?? ''));

            if ($correction !== '') {
                return $correction;
            }
        }

        $gps = trim((string) $gpsCoordinates);

        return $gps !== '' ? $gps : $encoded;
    }

    /**
     * Verified/actual coordinates only — empty until the inspector verifies or corrects.
     *
     * @param  array<string, mixed>|null  $verifications
     */
    public static function verifiedOrNull(
        ?string $encoded,
        ?array $verifications,
        ?string $gpsCoordinates = null,
    ): ?string {
        $encoded = trim((string) $encoded);
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (is_array($entry)) {
            if (($entry['verified'] ?? false) === true) {
                return $encoded !== '' ? $encoded : null;
            }

            $correction = trim((string) ($entry['correction'] ?? ''));

            if ($correction !== '') {
                return $correction;
            }
        }

        $gps = trim((string) $gpsCoordinates);

        return $gps !== '' ? $gps : null;
    }

    /**
     * @param  array<string, mixed>|null  $verifications
     */
    public static function status(
        ?string $encoded,
        ?array $verifications,
        ?string $gpsCoordinates = null,
    ): string {
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (is_array($entry)) {
            if (($entry['verified'] ?? false) === true) {
                return self::STATUS_VERIFIED_CORRECT;
            }

            if (trim((string) ($entry['correction'] ?? '')) !== '') {
                return self::STATUS_VERIFIED_CORRECTED;
            }
        }

        $encoded = trim((string) $encoded);
        $gps = trim((string) $gpsCoordinates);

        if ($gps !== '' && $encoded !== '' && $gps !== $encoded) {
            return self::STATUS_VERIFIED_CORRECTED;
        }

        return self::STATUS_NOT_YET_VERIFIED;
    }

    public static function fromReport(Document $document, ?object $report): string
    {
        return self::resolved(
            $document->coordinates,
            is_array($report?->field_verifications) ? $report->field_verifications : null,
            $report?->gps_coordinates,
        );
    }
}
