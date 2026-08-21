<?php

namespace App\Support;

class Measurements
{
    public const AREA_UNIT = 'sqm';

    public const LENGTH_UNIT = 'm';

    public static function formatArea(mixed $value, string $empty = ''): string
    {
        $numeric = self::stripAreaUnit($value);

        return $numeric === null ? $empty : $numeric.' '.self::AREA_UNIT;
    }

    public static function formatLength(mixed $value, string $empty = ''): string
    {
        $numeric = self::stripLengthUnit($value);

        return $numeric === null ? $empty : $numeric.' '.self::LENGTH_UNIT;
    }

    public static function stripAreaUnit(mixed $value): ?string
    {
        $trimmed = self::trimmed($value);

        if ($trimmed === null) {
            return null;
        }

        $stripped = preg_replace('/(?:\s*(?:square\s*meters?|sq\.?\s*m\.?|sqm))+$/i', '', $trimmed);
        $stripped = is_string($stripped) ? trim($stripped) : $trimmed;

        return $stripped === '' ? null : $stripped;
    }

    public static function stripLengthUnit(mixed $value): ?string
    {
        $trimmed = self::trimmed($value);

        if ($trimmed === null) {
            return null;
        }

        $stripped = preg_replace('/\s*(?:meters?|m)\s*$/i', '', $trimmed);
        $stripped = is_string($stripped) ? trim($stripped) : $trimmed;

        return $stripped === '' ? null : $stripped;
    }

    private static function trimmed(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        if ($trimmed === '' || $trimmed === '—' || $trimmed === '-') {
            return null;
        }

        return $trimmed;
    }
}
