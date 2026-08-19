<?php

namespace App\Support;

class FrontageRoads
{
    public const MAX_ROADS = 4;

    /**
     * Fixed frontage road keys in display order.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            'main',
            'second',
            'third',
            'fourth',
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            'main' => 'Main Road',
            'second' => '2nd Road',
            'third' => '3rd Road',
            'fourth' => '4th Road',
        ];
    }

    /**
     * @return array{
     *     key: string,
     *     label: string,
     *     name: string|null,
     *     standard_rrow: string|null,
     *     actual_rrow: string|null,
     *     min_setback: string|null,
     *     as_per_plan: string|null,
     *     frontage: string|null,
     *     remarks: string|null
     * }
     */
    public static function emptyRoad(string $key = 'main'): array
    {
        $labels = self::labels();

        return [
            'key' => $key,
            'label' => $labels[$key] ?? $labels['main'],
            'name' => null,
            'standard_rrow' => null,
            'actual_rrow' => null,
            'min_setback' => null,
            'as_per_plan' => null,
            'frontage' => null,
            'remarks' => null,
        ];
    }

    /**
     * @return list<array{
     *     key: string,
     *     label: string,
     *     name: string|null,
     *     standard_rrow: string|null,
     *     actual_rrow: string|null,
     *     min_setback: string|null,
     *     as_per_plan: string|null,
     *     frontage: string|null,
     *     remarks: string|null
     * }>
     */
    public static function default(): array
    {
        return [self::emptyRoad('main')];
    }

    /**
     * Normalize submitted frontage roads. Main Road is always present.
     *
     * @param  array<int, mixed>|null  $value
     * @return list<array{
     *     key: string,
     *     label: string,
     *     name: string|null,
     *     standard_rrow: string|null,
     *     actual_rrow: string|null,
     *     min_setback: string|null,
     *     as_per_plan: string|null,
     *     frontage: string|null,
     *     remarks: string|null
     * }>
     */
    public static function normalize(?array $value): array
    {
        $keys = self::keys();
        $labels = self::labels();
        $normalized = [];

        if ($value === null || $value === []) {
            return self::default();
        }

        $count = 0;

        foreach (array_values($value) as $entry) {
            if ($count >= self::MAX_ROADS || ! is_array($entry)) {
                continue;
            }

            $key = $keys[$count];
            $normalized[] = [
                'key' => $key,
                'label' => $labels[$key],
                'name' => self::nullableString($entry['name'] ?? null),
                'standard_rrow' => self::nullableString($entry['standardRrow'] ?? $entry['standard_rrow'] ?? null),
                'actual_rrow' => self::nullableString($entry['actualRrow'] ?? $entry['actual_rrow'] ?? null),
                'min_setback' => self::nullableString($entry['minSetback'] ?? $entry['min_setback'] ?? null),
                'as_per_plan' => self::nullableString($entry['asPerPlan'] ?? $entry['as_per_plan'] ?? null),
                'frontage' => self::nullableString($entry['frontage'] ?? null),
                'remarks' => self::nullableString($entry['remarks'] ?? null),
            ];
            $count++;
        }

        if ($normalized === []) {
            return self::default();
        }

        // Ensure first entry is always Main Road.
        $normalized[0]['key'] = 'main';
        $normalized[0]['label'] = $labels['main'];

        return $normalized;
    }

    /**
     * Build frontages from legacy flat road / frontage columns.
     *
     * @param  array<string, mixed>  $legacy
     * @return list<array{
     *     key: string,
     *     label: string,
     *     name: string|null,
     *     standard_rrow: string|null,
     *     actual_rrow: string|null,
     *     min_setback: string|null,
     *     as_per_plan: string|null,
     *     frontage: string|null,
     *     remarks: string|null
     * }>
     */
    public static function fromLegacy(array $legacy): array
    {
        $main = self::emptyRoad('main');
        $main['name'] = self::nullableString($legacy['road_category'] ?? null);
        $main['standard_rrow'] = self::nullableString($legacy['road_standard_rrow'] ?? null);
        $main['actual_rrow'] = self::nullableString($legacy['road_actual_rrow'] ?? null);
        $main['min_setback'] = self::nullableString($legacy['road_min_setback'] ?? null);
        $main['as_per_plan'] = self::nullableString($legacy['road_as_per_plan'] ?? null);
        $main['frontage'] = self::nullableString($legacy['front_setback'] ?? null);
        $main['remarks'] = self::nullableString($legacy['road_remarks'] ?? $legacy['remarks'] ?? null);

        return [$main];
    }

    /**
     * Sync legacy flat columns from the Main Road frontage entry.
     *
     * @param  list<array<string, mixed>>  $frontages
     * @return array{
     *     road_category: string|null,
     *     road_standard_rrow: string|null,
     *     road_actual_rrow: string|null,
     *     road_min_setback: string|null,
     *     road_as_per_plan: string|null,
     *     front_setback: string|null
     * }
     */
    public static function toLegacyColumns(array $frontages): array
    {
        $main = $frontages[0] ?? self::emptyRoad('main');

        return [
            'road_category' => self::nullableString($main['name'] ?? null),
            'road_standard_rrow' => self::nullableString($main['standard_rrow'] ?? null),
            'road_actual_rrow' => self::nullableString($main['actual_rrow'] ?? null),
            'road_min_setback' => self::nullableString($main['min_setback'] ?? null),
            'road_as_per_plan' => self::nullableString($main['as_per_plan'] ?? null),
            'front_setback' => self::nullableString($main['frontage'] ?? null),
        ];
    }

    /**
     * Prefer stored frontages; fall back to legacy flat columns.
     *
     * @param  array<int, mixed>|null  $frontages
     * @param  array<string, mixed>  $legacy
     * @return list<array{
     *     key: string,
     *     label: string,
     *     name: string|null,
     *     standard_rrow: string|null,
     *     actual_rrow: string|null,
     *     min_setback: string|null,
     *     as_per_plan: string|null,
     *     frontage: string|null,
     *     remarks: string|null
     * }>
     */
    public static function resolve(?array $frontages, array $legacy = []): array
    {
        if (is_array($frontages) && $frontages !== []) {
            return self::normalize($frontages);
        }

        $hasLegacy = collect([
            $legacy['road_category'] ?? null,
            $legacy['road_standard_rrow'] ?? null,
            $legacy['road_actual_rrow'] ?? null,
            $legacy['road_min_setback'] ?? null,
            $legacy['road_as_per_plan'] ?? null,
            $legacy['road_remarks'] ?? null,
            $legacy['front_setback'] ?? null,
        ])->contains(fn ($value) => self::nullableString($value) !== null);

        if ($hasLegacy) {
            return self::fromLegacy($legacy);
        }

        return self::default();
    }

    private static function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }
}
