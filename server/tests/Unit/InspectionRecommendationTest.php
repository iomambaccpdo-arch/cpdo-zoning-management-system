<?php

use App\Support\InspectionRecommendation;

function completeRecommendationInput(array $overrides = []): array
{
    return array_merge([
        'project_zoning_classification' => 'Residential-1 (R-1) Zone',
        'site_zoning_classification' => 'Residential-1 (R-1) Zone',
        'project_significance' => 'Local Significance',
        'right_over_land' => 'Land Title',
        'inspection_date' => '2026-07-20',
        'project_status_as_of_inspection' => 'No Construction (0%)',
        'has_inspection_photos' => true,
        'abutting_north' => 'Residential',
        'abutting_east' => 'Residential',
        'abutting_south' => 'Road',
        'abutting_west' => 'Vacant',
        'frontages' => [[
            'name' => 'Coastal Road',
            'standard_rrow' => '20 Meters',
            'actual_rrow' => '20',
            'min_setback' => '5',
            'as_per_plan' => '5',
        ]],
        'distance_center_line_to_building' => '15',
        'parking_space_requirement' => [
            'car' => '2',
            'bus' => null,
            'articulated_vehicle' => null,
            'standard_truck' => null,
            'jeepney_shuttle' => null,
        ],
        'parking_as_per_plan' => [
            'car' => '2',
            'bus' => null,
            'articulated_vehicle' => null,
            'standard_truck' => null,
            'jeepney_shuttle' => null,
        ],
        'type_of_lot' => 'Inside Lot',
        'lacking_documents' => 'N/A',
    ], $overrides);
}

it('recommends approved when all evaluation requirements are satisfied', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput()))
        ->toBe(InspectionRecommendation::APPROVED);
});

it('recommends non-conforming when project and site zoning differ', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'site_zoning_classification' => 'Commercial-1 (C-1) Zone',
    ])))->toBe(InspectionRecommendation::NON_CONFORMING);
});

it('recommends non-compliant when evaluation information is incomplete', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'abutting_north' => '',
    ])))->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('recommends non-compliant when minimum setback exceeds as-per-plan setback', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'frontages' => [[
            'name' => 'Coastal Road',
            'standard_rrow' => '20 Meters',
            'actual_rrow' => '20',
            'min_setback' => '5',
            'as_per_plan' => '3',
        ]],
    ])))->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('recommends non-compliant when RROW centerline distance is insufficient', function () {
    // Required = (20 / 2) + 5 = 15; distance 14 is deficient.
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'distance_center_line_to_building' => '14',
    ])))->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('recommends non-compliant when parking as per plan is below minimum', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'parking_as_per_plan' => [
            'car' => '1',
            'bus' => null,
            'articulated_vehicle' => null,
            'standard_truck' => null,
            'jeepney_shuttle' => null,
        ],
    ])))->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('recommends non-compliant when lacking documents is not N/A', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'lacking_documents' => 'Affidavit of Consent',
    ])))->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('prioritizes non-conforming over non-compliant deficiencies', function () {
    expect(InspectionRecommendation::determine(completeRecommendationInput([
        'site_zoning_classification' => 'Commercial-1 (C-1) Zone',
        'lacking_documents' => 'Affidavit of Consent',
    ])))->toBe(InspectionRecommendation::NON_CONFORMING);
});
