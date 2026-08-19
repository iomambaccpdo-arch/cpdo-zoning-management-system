<?php

use App\Support\ParkingSpaceRequirement;

it('defines vehicle type keys and labels', function () {
    expect(ParkingSpaceRequirement::keys())->toBe([
        'car',
        'bus',
        'articulated_vehicle',
        'standard_truck',
        'jeepney_shuttle',
    ])->and(ParkingSpaceRequirement::labels())->toBe([
        'car' => 'CAR',
        'bus' => 'BUS',
        'articulated_vehicle' => 'Articulated Vehicle',
        'standard_truck' => 'Standard Truck',
        'jeepney_shuttle' => 'Jeepney/Shuttle',
    ]);
});

it('normalizes parking space requirement values', function () {
    expect(ParkingSpaceRequirement::normalize([
        'car' => ' 2 ',
        'bus' => '',
        'articulated_vehicle' => '1',
        'unknown' => '9',
    ]))->toBe([
        'car' => '2',
        'bus' => null,
        'articulated_vehicle' => '1',
        'standard_truck' => null,
        'jeepney_shuttle' => null,
    ]);
});

it('formats parking space requirement for display', function () {
    expect(ParkingSpaceRequirement::format([
        'car' => '2',
        'bus' => null,
        'articulated_vehicle' => '1',
        'standard_truck' => '',
        'jeepney_shuttle' => '3',
    ]))->toBe('CAR: 2; Articulated Vehicle: 1; Jeepney/Shuttle: 3');
});
