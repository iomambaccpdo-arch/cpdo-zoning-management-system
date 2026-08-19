<?php

namespace App\Support;

class InspectionRecommendation
{
    public const NON_CONFORMING = 'Non-Conforming — For Notice of Non-Conformance';

    public const NON_COMPLIANT = 'Non-Compliant — For Notice of Deficiency';

    public const APPROVED = 'Approved';

    /**
     * @param  array{
     *     project_zoning_classification?: string|null,
     *     site_zoning_classification?: string|null,
     *     project_significance?: string|null,
     *     right_over_land?: string|null,
     *     inspection_date?: string|null,
     *     project_status_as_of_inspection?: string|null,
     *     has_inspection_photos?: bool,
     *     abutting_north?: string|null,
     *     abutting_east?: string|null,
     *     abutting_south?: string|null,
     *     abutting_west?: string|null,
     *     frontages?: list<array<string, mixed>>|null,
     *     distance_center_line_to_building?: string|null,
     *     parking_space_requirement?: array<string, string|null>|null,
     *     parking_as_per_plan?: array<string, string|null>|null,
     *     type_of_lot?: string|null,
     *     lacking_documents?: string|null,
     * }  $input
     */
    public static function determine(array $input): string
    {
        if (self::isNonConforming($input)) {
            return self::NON_CONFORMING;
        }

        if (self::isNonCompliant($input)) {
            return self::NON_COMPLIANT;
        }

        return self::APPROVED;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public static function isNonConforming(array $input): bool
    {
        $project = self::normalizeComparable($input['project_zoning_classification'] ?? null);
        $site = self::normalizeComparable($input['site_zoning_classification'] ?? null);

        if ($project === '' || $site === '') {
            return false;
        }

        return $project !== $site;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public static function isNonCompliant(array $input): bool
    {
        if (self::hasIncompleteEvaluation($input)) {
            return true;
        }

        if (self::hasSetbackDeficiency($input['frontages'] ?? null)) {
            return true;
        }

        if (self::hasRrowDistanceDeficiency(
            $input['frontages'] ?? null,
            $input['distance_center_line_to_building'] ?? null,
        )) {
            return true;
        }

        if (self::hasParkingDeficiency(
            $input['parking_space_requirement'] ?? null,
            $input['parking_as_per_plan'] ?? null,
        )) {
            return true;
        }

        return self::hasLackingDocuments($input['lacking_documents'] ?? null);
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public static function hasIncompleteEvaluation(array $input): bool
    {
        $requiredScalars = [
            $input['project_significance'] ?? null,
            $input['right_over_land'] ?? null,
            $input['inspection_date'] ?? null,
            $input['project_status_as_of_inspection'] ?? null,
            $input['abutting_north'] ?? null,
            $input['abutting_east'] ?? null,
            $input['abutting_south'] ?? null,
            $input['abutting_west'] ?? null,
            $input['distance_center_line_to_building'] ?? null,
            $input['type_of_lot'] ?? null,
            $input['lacking_documents'] ?? null,
        ];

        foreach ($requiredScalars as $value) {
            if (self::isBlank($value)) {
                return true;
            }
        }

        if (! ($input['has_inspection_photos'] ?? false)) {
            return true;
        }

        $frontages = is_array($input['frontages'] ?? null) ? $input['frontages'] : [];
        $main = $frontages[0] ?? null;

        if (! is_array($main)) {
            return true;
        }

        foreach (['name', 'standard_rrow', 'actual_rrow', 'min_setback', 'as_per_plan'] as $key) {
            $camel = match ($key) {
                'standard_rrow' => 'standardRrow',
                'actual_rrow' => 'actualRrow',
                'min_setback' => 'minSetback',
                'as_per_plan' => 'asPerPlan',
                default => $key,
            };

            $value = $main[$key] ?? $main[$camel] ?? null;
            if (self::isBlank($value)) {
                return true;
            }
        }

        $minimum = ParkingSpaceRequirement::normalize(
            is_array($input['parking_space_requirement'] ?? null)
                ? $input['parking_space_requirement']
                : null
        );
        $asPerPlan = ParkingSpaceRequirement::normalize(
            is_array($input['parking_as_per_plan'] ?? null)
                ? $input['parking_as_per_plan']
                : null
        );

        $hasAnyParking = false;

        foreach (ParkingSpaceRequirement::keys() as $key) {
            if ($minimum[$key] !== null || $asPerPlan[$key] !== null) {
                $hasAnyParking = true;
            }

            if ($minimum[$key] !== null && $asPerPlan[$key] === null) {
                return true;
            }
        }

        return ! $hasAnyParking;
    }

    /**
     * @param  list<array<string, mixed>>|null  $frontages
     */
    public static function hasSetbackDeficiency(?array $frontages): bool
    {
        if (! is_array($frontages)) {
            return false;
        }

        foreach ($frontages as $road) {
            if (! is_array($road)) {
                continue;
            }

            $minimum = self::parseNumber($road['min_setback'] ?? $road['minSetback'] ?? null);
            $asPerPlan = self::parseNumber($road['as_per_plan'] ?? $road['asPerPlan'] ?? null);

            if ($minimum === null || $asPerPlan === null) {
                continue;
            }

            if ($minimum > $asPerPlan) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array<string, mixed>>|null  $frontages
     */
    public static function hasRrowDistanceDeficiency(?array $frontages, mixed $distanceCenterLine): bool
    {
        $distance = self::parseNumber($distanceCenterLine);

        if ($distance === null || ! is_array($frontages) || $frontages === []) {
            return false;
        }

        $main = $frontages[0] ?? null;

        if (! is_array($main)) {
            return false;
        }

        $standard = self::parseNumber($main['standard_rrow'] ?? $main['standardRrow'] ?? null);
        $minSetback = self::parseNumber($main['min_setback'] ?? $main['minSetback'] ?? null);

        if ($standard === null || $minSetback === null) {
            return false;
        }

        $required = ($standard / 2) + $minSetback;

        return $distance < $required;
    }

    /**
     * @param  array<string, mixed>|null  $minimum
     * @param  array<string, mixed>|null  $asPerPlan
     */
    public static function hasParkingDeficiency(?array $minimum, ?array $asPerPlan): bool
    {
        $required = ParkingSpaceRequirement::normalize($minimum);
        $planned = ParkingSpaceRequirement::normalize($asPerPlan);

        foreach (ParkingSpaceRequirement::keys() as $key) {
            if ($required[$key] === null || $planned[$key] === null) {
                continue;
            }

            if ((float) $planned[$key] < (float) $required[$key]) {
                return true;
            }
        }

        return false;
    }

    public static function hasLackingDocuments(mixed $value): bool
    {
        if (self::isBlank($value)) {
            return false;
        }

        return strcasecmp(trim((string) $value), 'N/A') !== 0;
    }

    public static function parseNumber(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        if ($trimmed === '') {
            return null;
        }

        if (! preg_match('/(\d+(?:\.\d+)?)/', $trimmed, $matches)) {
            return null;
        }

        return (float) $matches[1];
    }

    private static function normalizeComparable(mixed $value): string
    {
        return mb_strtolower(trim((string) $value));
    }

    private static function isBlank(mixed $value): bool
    {
        return trim((string) ($value ?? '')) === '';
    }
}
