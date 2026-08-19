<?php

namespace App\Support;

use App\Models\Document;

class DocumentPropertyDetails
{
    /**
     * @param  array<int, array<string, mixed>>|null  $buildings
     * @return array<int, array{name: string, area: string}>
     */
    public static function normalizeBuildings(?array $buildings): array
    {
        if (! is_array($buildings)) {
            return [];
        }

        $normalized = [];

        foreach ($buildings as $building) {
            if (! is_array($building)) {
                continue;
            }

            $name = trim((string) ($building['name'] ?? ''));
            $area = trim((string) ($building['area'] ?? ''));

            if ($name === '' && $area === '') {
                continue;
            }

            $normalized[] = [
                'name' => $name,
                'area' => $area,
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $lots
     * @return array<int, array{land_title: string, area: string}>
     */
    public static function normalizeLots(?array $lots): array
    {
        if (! is_array($lots)) {
            return [];
        }

        $normalized = [];

        foreach ($lots as $lot) {
            if (! is_array($lot)) {
                continue;
            }

            $landTitle = trim((string) ($lot['land_title'] ?? $lot['landTitle'] ?? ''));
            $area = trim((string) ($lot['area'] ?? ''));

            if ($landTitle === '' && $area === '') {
                continue;
            }

            $normalized[] = [
                'land_title' => $landTitle,
                'area' => $area,
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param  array<int, array{name: string, area: string}>  $buildings
     */
    public static function deriveFloorArea(array $buildings): string
    {
        return collect($buildings)
            ->pluck('area')
            ->filter(fn (string $area): bool => $area !== '')
            ->implode(' / ');
    }

    /**
     * @param  array<int, array{land_title: string, area: string}>  $lots
     */
    public static function deriveLotArea(array $lots): string
    {
        return collect($lots)
            ->pluck('area')
            ->filter(fn (string $area): bool => $area !== '')
            ->implode(' / ');
    }

    public static function formatAreaDetails(Document $document): string
    {
        $lines = [];

        foreach ($document->buildings ?? [] as $index => $building) {
            $number = $index + 1;
            $name = trim((string) ($building['name'] ?? ''));
            $area = trim((string) ($building['area'] ?? ''));
            $label = $name !== '' ? $name : "Building {$number}";
            $areaLabel = $area !== '' ? "{$area} SQ.M AS PER PLAN" : '—';
            $lines[] = "Building {$number}: {$label} — {$areaLabel}";
        }

        foreach ($document->lots ?? [] as $index => $lot) {
            $number = $index + 1;
            $title = trim((string) ($lot['land_title'] ?? ''));
            $area = trim((string) ($lot['area'] ?? ''));
            $titleLabel = $title !== '' ? $title : "Lot {$number}";
            $areaLabel = $area !== '' ? "{$area} SQ.M" : '—';
            $lines[] = "Lot {$number}: {$titleLabel} — {$areaLabel}";
        }

        if ($lines === []) {
            $legacyLot = $document->lot_area ? "Lot: {$document->lot_area} SQ.M" : null;
            $legacyBldg = $document->floor_area
                ? "Bldg: {$document->floor_area} SQ.M AS PER PLAN"
                : null;

            return collect([$legacyLot, $legacyBldg])->filter()->implode("\n");
        }

        return implode("\n", $lines);
    }

    public static function formatLocationDetails(Document $document): string
    {
        $parts = array_filter([
            $document->purok?->name ? 'Purok '.$document->purok->name : null,
            $document->barangay?->name ? 'Brgy. '.$document->barangay->name : null,
            'Panabo City',
        ]);

        return implode(', ', $parts);
    }

    public static function formatFloorAreaForClearance(Document $document): string
    {
        $buildings = $document->buildings ?? [];

        if ($buildings !== []) {
            $parts = [];

            foreach ($buildings as $index => $building) {
                $number = $index + 1;
                $name = trim((string) ($building['name'] ?? ''));
                $area = trim((string) ($building['area'] ?? ''));
                $label = $name !== '' ? $name : "Building {$number}";
                $areaLabel = $area !== '' ? "{$area} SQUARE METERS" : '—';
                $parts[] = "{$label}: {$areaLabel}";
            }

            return implode('; ', $parts);
        }

        return $document->floor_area ? $document->floor_area.' SQUARE METERS' : '—';
    }

    public static function formatLotAreaForClearance(Document $document): string
    {
        $lots = $document->lots ?? [];

        if ($lots !== []) {
            $parts = [];

            foreach ($lots as $index => $lot) {
                $number = $index + 1;
                $title = trim((string) ($lot['land_title'] ?? ''));
                $area = trim((string) ($lot['area'] ?? ''));
                $label = $title !== '' ? $title : "Lot {$number}";
                $areaLabel = $area !== '' ? "{$area} SQUARE METERS" : '—';
                $parts[] = "{$label}: {$areaLabel}";
            }

            return implode('; ', $parts);
        }

        return $document->lot_area ? $document->lot_area.' SQUARE METERS' : '—';
    }

    /**
     * @return array{buildings: array<int, array{name: string, area: string}>, lots: array<int, array{land_title: string, area: string}>, floor_area: string, lot_area: string}
     */
    public static function fromRequestPayload(?array $buildings, ?array $lots, string $fallbackFloorArea = '', string $fallbackLotArea = ''): array
    {
        $normalizedBuildings = self::normalizeBuildings($buildings);
        $normalizedLots = self::normalizeLots($lots);

        return [
            'buildings' => $normalizedBuildings,
            'lots' => $normalizedLots,
            'floor_area' => self::deriveFloorArea($normalizedBuildings) ?: $fallbackFloorArea,
            'lot_area' => self::deriveLotArea($normalizedLots) ?: $fallbackLotArea,
        ];
    }
}
