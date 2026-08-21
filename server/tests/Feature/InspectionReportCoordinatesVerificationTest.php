<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\GeographicCoordinates;
use App\Support\LocationalClearanceBuilder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

function coordinatesVerificationInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-coordinates@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function coordinatesVerificationDocument(User $user, string $status = 'encoded'): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
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
        'document_title' => 'Coordinates LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-COORD-0001',
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
        'coordinates' => '7.123000, 125.456000',
        'floor_area' => '100',
        'lot_area' => '200',
        'storey' => '2',
        'mezanine' => null,
        'status' => $status,
    ]);
}

it('stores verified encoded coordinates without changing the document', function () {
    $inspector = coordinatesVerificationInspector();
    $document = coordinatesVerificationDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'coordinates' => [
                'verified' => true,
                'correction' => '7.999000, 125.999000',
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();
    $document->refresh();

    expect($response->json('report.field_verifications.coordinates.verified'))->toBeTrue()
        ->and($response->json('report.field_verifications.coordinates.correction'))->toBeNull()
        ->and($response->json('report.gps_coordinates'))->toBe('7.123000, 125.456000')
        ->and($document->coordinates)->toBe('7.123000, 125.456000')
        ->and(GeographicCoordinates::status(
            $document->coordinates,
            $response->json('report.field_verifications'),
            $response->json('report.gps_coordinates'),
        ))->toBe(GeographicCoordinates::STATUS_VERIFIED_CORRECT);
});

it('stores inspector actual coordinates without overwriting encoded coordinates', function () {
    $inspector = coordinatesVerificationInspector();
    $document = coordinatesVerificationDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'coordinates' => [
                'verified' => false,
                'correction' => '7.304200, 125.687300',
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();
    $document->refresh();

    expect($response->json('report.field_verifications.coordinates.verified'))->toBeFalse()
        ->and($response->json('report.field_verifications.coordinates.correction'))->toBe('7.304200, 125.687300')
        ->and($response->json('report.gps_coordinates'))->toBe('7.304200, 125.687300')
        ->and($document->coordinates)->toBe('7.123000, 125.456000')
        ->and(GeographicCoordinates::status(
            $document->coordinates,
            $response->json('report.field_verifications'),
            $response->json('report.gps_coordinates'),
        ))->toBe(GeographicCoordinates::STATUS_VERIFIED_CORRECTED);
});

it('requires coordinate verification or actual coordinates before submitting the evaluation report', function () {
    $inspector = coordinatesVerificationInspector();
    $document = coordinatesVerificationDocument($inspector);

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'inspectionDate' => now()->toDateString(),
        'projectStatusAsOfInspection' => 'No Construction (0%)',
        'abuttingNorth' => 'Residential',
        'abuttingSouth' => 'Residential',
        'abuttingEast' => 'Residential',
        'abuttingWest' => 'Residential',
        'frontages' => [
            [
                'name' => 'National Highway',
                'standardRrow' => '20 Meters',
                'actualRrow' => '20',
                'minSetback' => '5',
                'asPerPlan' => '6',
            ],
        ],
        'typeOfLot' => 'Interior Lot',
        'lackingDocuments' => 'N/A',
        'distanceCenterLineToBuilding' => '15',
        'inspectorSignature' => 'Zoning Inspector',
        'submit' => true,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['fieldVerifications.coordinates.correction']);

    expect($document->fresh()->coordinates)->toBe('7.123000, 125.456000');
});

it('uses verified actual coordinates in the locational clearance location', function () {
    $inspector = coordinatesVerificationInspector();
    $document = coordinatesVerificationDocument($inspector, 'approved');

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'location_details' => 'Purok 5, Brgy. Kasilak, Panabo City',
        'landmark' => 'Along Coastal Road',
        'field_verifications' => [
            'coordinates' => [
                'verified' => false,
                'correction' => '7.304200, 125.687300',
            ],
        ],
        'gps_coordinates' => '7.304200, 125.687300',
        'right_over_land' => 'Land Title',
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['location'])->toStartWith('7.304200, 125.687300 /')
        ->and($data['location'])->not->toStartWith('7.123000, 125.456000 /')
        ->and($document->coordinates)->toBe('7.123000, 125.456000');
});
