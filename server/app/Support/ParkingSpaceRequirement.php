<?php

namespace App\Support;

class ParkingSpaceRequirement
{
    /**
     * Vehicle type keys stored in parking_space_requirement JSON.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            'car',
            'bus',
            'articulated_vehicle',
            'standard_truck',
            'jeepney_shuttle',
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            'car' => 'CAR',
            'bus' => 'BUS',
            'articulated_vehicle' => 'Articulated Vehicle',
            'standard_truck' => 'Standard Truck',
            'jeepney_shuttle' => 'Jeepney/Shuttle',
        ];
    }

    /**
     * @return array<string, string|null>
     */
    public static function empty(): array
    {
        return array_fill_keys(self::keys(), null);
    }

    /**
     * @param  array<string, mixed>|null  $value
     * @return array<string, string|null>
     */
    public static function normalize(?array $value): array
    {
        $normalized = self::empty();

        if ($value === null) {
            return $normalized;
        }

        foreach (self::keys() as $key) {
            if (! array_key_exists($key, $value)) {
                continue;
            }

            $raw = $value[$key];

            if ($raw === null) {
                $normalized[$key] = null;

                continue;
            }

            $trimmed = trim((string) $raw);
            $normalized[$key] = $trimmed === '' ? null : $trimmed;
        }

        return $normalized;
    }

    /**
     * @param  array<string, string|null>|null  $value
     */
    public static function format(?array $value): string
    {
        $normalized = self::normalize($value);
        $labels = self::labels();
        $parts = [];

        foreach (self::keys() as $key) {
            $slot = $normalized[$key];
            if ($slot === null) {
                continue;
            }

            $parts[] = $labels[$key].': '.$slot;
        }

        return implode('; ', $parts);
    }
}
