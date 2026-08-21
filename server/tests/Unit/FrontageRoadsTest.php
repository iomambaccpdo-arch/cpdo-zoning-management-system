<?php

use App\Support\FrontageRoads;

it('defines frontage road keys and labels', function () {
    expect(FrontageRoads::keys())->toBe([
        'main',
        'second',
        'third',
        'fourth',
    ])->and(FrontageRoads::labels())->toBe([
        'main' => 'Main Road',
        'second' => '2nd Road',
        'third' => '3rd Road',
        'fourth' => '4th Road',
    ]);
});

it('always includes main road by default', function () {
    expect(FrontageRoads::normalize(null))->toBe([
        [
            'key' => 'main',
            'label' => 'Main Road',
            'name' => null,
            'standard_rrow' => null,
            'actual_rrow' => null,
            'min_setback' => null,
            'as_per_plan' => null,
            'frontage' => null,
            'remarks' => null,
        ],
    ]);
});

it('normalizes camelCase and snake_case frontage payloads', function () {
    expect(FrontageRoads::normalize([
        [
            'name' => ' Coastal Road ',
            'standardRrow' => '6 Meters',
            'actualRrow' => '6.0',
            'minSetback' => '3',
            'asPerPlan' => '3.5',
            'frontage' => '12',
            'remarks' => 'Main',
        ],
        [
            'name' => 'Brgy. Road',
            'standard_rrow' => '8 Meters',
            'actual_rrow' => '8',
            'min_setback' => '2',
            'as_per_plan' => '2',
            'frontage' => '10',
            'remarks' => '',
        ],
    ]))->toBe([
        [
            'key' => 'main',
            'label' => 'Main Road',
            'name' => 'Coastal Road',
            'standard_rrow' => '6',
            'actual_rrow' => '6.0',
            'min_setback' => '3',
            'as_per_plan' => '3.5',
            'frontage' => '12',
            'remarks' => 'Main',
        ],
        [
            'key' => 'second',
            'label' => '2nd Road',
            'name' => 'Brgy. Road',
            'standard_rrow' => '8',
            'actual_rrow' => '8',
            'min_setback' => '2',
            'as_per_plan' => '2',
            'frontage' => '10',
            'remarks' => null,
        ],
    ]);
});

it('syncs legacy flat columns from the main road entry', function () {
    $frontages = FrontageRoads::normalize([
        [
            'name' => 'Main Blvd',
            'standardRrow' => '20 Meters',
            'actualRrow' => '18',
            'minSetback' => '5',
            'asPerPlan' => '5',
            'frontage' => '25',
            'remarks' => 'OK',
        ],
        [
            'name' => 'Side Road',
            'frontage' => '8',
        ],
    ]);

    expect(FrontageRoads::toLegacyColumns($frontages))->toBe([
        'road_category' => 'Main Blvd',
        'road_standard_rrow' => '20',
        'road_actual_rrow' => '18',
        'road_min_setback' => '5',
        'road_as_per_plan' => '5',
        'front_setback' => '25',
    ]);
});

it('builds frontages from legacy columns when needed', function () {
    expect(FrontageRoads::resolve(null, [
        'road_category' => 'Old Road',
        'road_standard_rrow' => '10 Meters',
        'road_actual_rrow' => '10',
        'road_min_setback' => '3',
        'road_as_per_plan' => '3',
        'road_remarks' => 'Legacy',
        'front_setback' => '15',
    ]))->toBe([
        [
            'key' => 'main',
            'label' => 'Main Road',
            'name' => 'Old Road',
            'standard_rrow' => '10',
            'actual_rrow' => '10',
            'min_setback' => '3',
            'as_per_plan' => '3',
            'frontage' => '15',
            'remarks' => 'Legacy',
        ],
    ]);
});
