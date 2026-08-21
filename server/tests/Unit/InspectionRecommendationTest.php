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

it('returns no findings when the evaluation is complete and compliant', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput()))
        ->toBe([]);
});

it('lists zoning mismatch as a finding', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'site_zoning_classification' => 'Commercial-1 (C-1) Zone',
    ])))->toBe([InspectionRecommendation::FINDING_ZONING_NON_CONFORMING]);
});

it('lists setback deficiency as a finding', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'frontages' => [[
            'name' => 'Coastal Road',
            'standard_rrow' => '20 Meters',
            'actual_rrow' => '20',
            'min_setback' => '5',
            'as_per_plan' => '3',
        ]],
    ])))->toBe([InspectionRecommendation::FINDING_SETBACK_DOES_NOT_COMPLY]);
});

it('lists RROW centerline distance deficiency as a finding', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'distance_center_line_to_building' => '14',
    ])))->toBe([InspectionRecommendation::FINDING_RROW_DISTANCE_DOES_NOT_COMPLY]);
});

it('lists parking deficiency as a finding', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'parking_as_per_plan' => [
            'car' => '1',
            'bus' => null,
            'articulated_vehicle' => null,
            'standard_truck' => null,
            'jeepney_shuttle' => null,
        ],
    ])))->toBe([InspectionRecommendation::FINDING_PARKING_REQUIREMENT_NOT_MET]);
});

it('splits lacking documents into individual findings', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'lacking_documents' => "Barangay Clearance, Corrected Site Plan\nAffidavit of Consent",
    ])))->toBe([
        InspectionRecommendation::FINDING_MISSING_BARANGAY_CLEARANCE,
        InspectionRecommendation::FINDING_CORRECTED_SITE_PLAN_REQUIRED,
        'Affidavit of Consent',
    ]);
});

it('canonicalizes generic lacking document text', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'lacking_documents' => 'Additional Document Required',
    ])))->toBe([InspectionRecommendation::FINDING_ADDITIONAL_DOCUMENT_REQUIRED]);
});

it('lists geographic coordinates that still need verification', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'coordinates_need_verification' => true,
    ])))->toBe([InspectionRecommendation::FINDING_GEOGRAPHIC_COORDINATES_NEED_VERIFICATION]);
});

it('lists corrected site plan when location or project fields were corrected', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'field_verifications' => [
            'location' => ['verified' => false, 'correction' => 'Purok 2, Kasilak'],
        ],
    ])))->toBe([InspectionRecommendation::FINDING_CORRECTED_SITE_PLAN_REQUIRED]);
});

it('lists corrected site plan when the inspector selected a different project type', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'field_verifications' => [
            'project_type' => [
                'verified' => false,
                'correction' => null,
                'zoning_id' => 2,
                'project_type_id' => 8,
                'specific_project_type_id' => null,
            ],
        ],
    ])))->toBe([InspectionRecommendation::FINDING_CORRECTED_SITE_PLAN_REQUIRED]);
});

it('does not treat verified original values as a corrected site plan', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'field_verifications' => [
            'location' => ['verified' => true, 'correction' => 'Purok 2, Kasilak'],
            'project_type' => ['verified' => true, 'correction' => ''],
        ],
    ])))->toBe([]);
});

it('lists missing inspection photos as a finding', function () {
    expect(InspectionRecommendation::findings(completeRecommendationInput([
        'has_inspection_photos' => false,
    ])))->toBe([InspectionRecommendation::FINDING_INSPECTION_PHOTOS_REQUIRED]);
});

it('returns the recommendation together with its findings', function () {
    expect(InspectionRecommendation::evaluate(completeRecommendationInput([
        'frontages' => [[
            'name' => 'Coastal Road',
            'standard_rrow' => '20 Meters',
            'actual_rrow' => '20',
            'min_setback' => '5',
            'as_per_plan' => '3',
        ]],
        'lacking_documents' => 'Barangay Clearance',
        'coordinates_need_verification' => true,
    ])))->toBe([
        'recommendation' => InspectionRecommendation::NON_COMPLIANT,
        'findings' => [
            InspectionRecommendation::FINDING_SETBACK_DOES_NOT_COMPLY,
            InspectionRecommendation::FINDING_GEOGRAPHIC_COORDINATES_NEED_VERIFICATION,
            InspectionRecommendation::FINDING_MISSING_BARANGAY_CLEARANCE,
        ],
    ]);
});
