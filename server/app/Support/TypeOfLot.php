<?php

namespace App\Support;

class TypeOfLot
{
    /**
     * Locational clearance type of lot options.
     *
     * @return list<string>
     */
    public static function options(): array
    {
        return [
            'Interior Lot',
            'Inside Lot',
            'Corner Lot',
            'Through Lot',
            'Corner Through Lot',
            'End Lot',
        ];
    }
}
