<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\InspectionRecommendation;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function recommendationTestInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-recommendation@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function recommendationTestDocument(User $user, string $zoningName = 'Residential-1 (R-1) Zone'): Document
{
    $zoning = Zoning::create(['name' => $zoningName]);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Single Detached',
    ]);
    $barangay = Barangay::create(['name' => 'Kasilak']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => '5',
    ]);

    return Document::create([
        'document_title' => 'Recommendation LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-RC-0001',
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Juan Dela Cruz',
        'received_by' => $user->fullName(),
        'received_by_user_id' => $user->id,
        'assisted_by' => null,
        'oic' => 'Jane Approver',
        'barangay_id' => $barangay->id,
        'purok_id' => $purok->id,
        'landmark' => 'Near City Hall',
        'coordinates' => '7.123,125.456',
        'floor_area' => '100',
        'lot_area' => '200',
        'storey' => '2',
        'mezanine' => null,
        'status' => 'encoded',
    ]);
}

function completeRecommendationPayload(array $overrides = []): array
{
    return array_merge([
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'inspectionDate' => now()->toDateString(),
        'projectStatusAsOfInspection' => 'No Construction (0%)',
        'gpsCoordinates' => '7.123,125.456',
        'abuttingNorth' => 'Residential',
        'abuttingEast' => 'Residential',
        'abuttingSouth' => 'Road',
        'abuttingWest' => 'Vacant',
        'frontages' => [[
            'name' => 'Coastal Road',
            'standardRrow' => '20 Meters',
            'actualRrow' => '20',
            'minSetback' => '5',
            'asPerPlan' => '5',
            'frontage' => '25',
        ]],
        'distanceCenterLineToBuilding' => '15',
        'parkingSpaceRequirement' => [
            'car' => '2',
            'bus' => '',
            'articulated_vehicle' => '',
            'standard_truck' => '',
            'jeepney_shuttle' => '',
        ],
        'parkingAsPerPlan' => [
            'car' => '2',
            'bus' => '',
            'articulated_vehicle' => '',
            'standard_truck' => '',
            'jeepney_shuttle' => '',
        ],
        'typeOfLot' => 'Inside Lot',
        'lackingDocuments' => 'N/A',
        'inspectorSignature' => 'Zoning Inspector',
        'submit' => false,
    ], $overrides);
}

function attachInspectionPhoto(Document $document, InspectionReport $report, User $user): void
{
    DocumentAttachment::create([
        'document_id' => $document->id,
        'inspection_report_id' => $report->id,
        'uploaded_by' => $user->id,
        'file_path' => "documents/2026/07/{$document->id}/inspection/{$report->id}/photo.jpg",
        'file_name' => 'photo.jpg',
        'file_type' => 'image/jpeg',
        'file_size' => 1024,
        'attachment_type' => 'inspection_photo',
    ]);
}

it('auto-assigns non-compliant recommendation when evaluation is incomplete', function () {
    $inspector = recommendationTestInspector();
    $document = recommendationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        completeRecommendationPayload([
            'abuttingNorth' => '',
            'decisionRecommended' => 'Approved',
        ])
    );

    $response->assertCreated();
    expect($response->json('report.decision_recommended'))
        ->toBe(InspectionRecommendation::NON_COMPLIANT);
});

it('auto-assigns non-conforming when site zoning correction differs from project zoning', function () {
    $inspector = recommendationTestInspector();
    $document = recommendationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        completeRecommendationPayload([
            'fieldVerifications' => [
                'project_classification' => ['verified' => true, 'correction' => ''],
                'site_zoning_classification' => [
                    'verified' => false,
                    'correction' => 'Commercial-1 (C-1) Zone',
                ],
            ],
        ])
    );

    $response->assertCreated();
    expect($response->json('report.decision_recommended'))
        ->toBe(InspectionRecommendation::NON_CONFORMING);
});

it('auto-assigns approved when a complete conforming evaluation has photos', function () {
    $inspector = recommendationTestInspector();
    $document = recommendationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $draft = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        completeRecommendationPayload()
    )->assertCreated();

    $report = InspectionReport::findOrFail($draft->json('report.id'));
    attachInspectionPhoto($document, $report, $inspector);

    $response = $this->putJson(
        "/api/documents/{$document->id}/inspection-report/{$report->id}",
        completeRecommendationPayload([
            'fieldVerifications' => [
                'project_classification' => ['verified' => true, 'correction' => ''],
                'site_zoning_classification' => ['verified' => true, 'correction' => ''],
                'applicant_name' => ['verified' => true, 'correction' => ''],
                'corporation_name' => ['verified' => true, 'correction' => ''],
                'applicant_address' => ['verified' => true, 'correction' => ''],
                'corporation_address' => ['verified' => true, 'correction' => ''],
                'project_type' => ['verified' => true, 'correction' => ''],
                'location' => ['verified' => true, 'correction' => ''],
                'area_details' => ['verified' => true, 'correction' => ''],
            ],
            'submit' => true,
        ])
    );

    $response->assertOk();
    expect($response->json('report.decision_recommended'))
        ->toBe(InspectionRecommendation::APPROVED)
        ->and($response->json('report.lacking_documents'))->toBe('N/A')
        ->and($response->json('report.parking_as_per_plan.car'))->toBe('2');
});

it('auto-assigns non-compliant for lacking documents other than N/A', function () {
    $inspector = recommendationTestInspector();
    $document = recommendationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        completeRecommendationPayload([
            'lackingDocuments' => 'Deed of Sale',
        ])
    );

    $response->assertCreated();
    expect($response->json('report.decision_recommended'))
        ->toBe(InspectionRecommendation::NON_COMPLIANT);
});
