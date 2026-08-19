<?php

namespace App\Support;

class ZoningClassification
{
    /**
     * Normalize ordinance zoning labels into display classification names.
     *
     * Examples:
     * - "Section 12.11. Regulations in Commercial-1 (C-1) Zone" → "Commercial-1 (C-1) Zone"
     * - "Section 12.16. Regulations in Industrial-3 (1-3) Zone" → "Industrial-3 (I-3) Zone"
     */
    public static function format(?string $name): string
    {
        $formatted = trim((string) $name);

        if ($formatted === '') {
            return '';
        }

        $formatted = preg_replace('/^Section\s+[\d.]+\s*/i', '', $formatted) ?? $formatted;
        $formatted = preg_replace('/^Regulations\s+in\s+/i', '', $formatted) ?? $formatted;

        // Ordinance source uses digit "1" instead of letter "I" for Industrial zone codes.
        $formatted = preg_replace(
            '/\b(Industrial-\d+)\s+\(1-(\d+)\)/i',
            '$1 (I-$2)',
            $formatted,
        ) ?? $formatted;

        return trim($formatted);
    }
}
