<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\SpecificProjectType;
use App\Models\User;
use App\Models\Zoning;
use App\Support\LocationalClearanceBuilder;
use App\Support\ProjectTypeClassification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

function projectTypeVerificationInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-project-type@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

/**
 * @return array{document: Document, encodedZoning: Zoning, encodedType: ProjectType, correctedZoning: Zoning, correctedType: ProjectType, correctedSpecific: SpecificProjectType}
 */
function projectTypeVerificationFixture(User $user, string $status = 'encoded'): array
{
    $encodedZoning = Zoning::create(['name' => 'Residential Zone']);
    $encodedType = ProjectType::create([
        'zoning_id' => $encodedZoning->id,
        'name' => 'Single Detached',
    ]);

    $correctedZoning = Zoning::create(['name' => 'Commercial Zone']);
    $correctedType = ProjectType::create([
        'zoning_id' => $correctedZoning->id,
        'name' => 'Warehouse',
    ]);
    $correctedSpecific = SpecificProjectType::create([
        'project_type_id' => $correctedType->id,
        'name' => 'Cold Storage',
    ]);

    $barangay = Barangay::create(['name' => 'Kasilak']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => '5',
    ]);

    $document = Document::create([
        'document_title' => 'Project Type LC',
        'zoning_id' => $encodedZoning->id,
        'zoning_application_no' => 'LC-2026-PT-0001',
        'project_type_id' => $encodedType->id,
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

    return [
        'document' => $document,
        'encodedZoning' => $encodedZoning,
        'encodedType' => $encodedType,
        'correctedZoning' => $correctedZoning,
        'correctedType' => $correctedType,
        'correctedSpecific' => $correctedSpecific,
    ];
}

it('stores a verified-correct project type without changing the encoded document classification', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector);
    $document = $fixture['document'];

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'project_type' => [
                'verified' => true,
                'correction' => 'Warehouse — Cold Storage',
                'zoning_id' => $fixture['correctedZoning']->id,
                'project_type_id' => $fixture['correctedType']->id,
                'specific_project_type_id' => $fixture['correctedSpecific']->id,
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();
    $document->refresh();

    expect($response->json('report.field_verifications.project_type.verified'))->toBeTrue()
        ->and($response->json('report.field_verifications.project_type.correction'))->toBeNull()
        ->and($response->json('report.field_verifications.project_type.zoning_id'))->toBeNull()
        ->and($document->zoning_id)->toBe($fixture['encodedZoning']->id)
        ->and($document->project_type_id)->toBe($fixture['encodedType']->id)
        ->and($document->specific_project_type_id)->toBeNull()
        ->and(ProjectTypeClassification::status(
            $document,
            $response->json('report.field_verifications'),
        ))->toBe(ProjectTypeClassification::STATUS_VERIFIED_CORRECT)
        ->and(ProjectTypeClassification::resolved(
            $document,
            $response->json('report.field_verifications'),
        ))->toBe('Single Detached');
});

it('stores an inspector-corrected project type from the ordinance list without overwriting encoded values', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector);
    $document = $fixture['document'];

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'project_type' => [
                'verified' => false,
                'zoning_id' => $fixture['correctedZoning']->id,
                'project_type_id' => $fixture['correctedType']->id,
                'specific_project_type_id' => $fixture['correctedSpecific']->id,
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();
    $document->refresh();

    expect($response->json('report.field_verifications.project_type.verified'))->toBeFalse()
        ->and($response->json('report.field_verifications.project_type.correction'))->toBe('Warehouse — Cold Storage')
        ->and($response->json('report.field_verifications.project_type.zoning_id'))->toBe($fixture['correctedZoning']->id)
        ->and($response->json('report.field_verifications.project_type.project_type_id'))->toBe($fixture['correctedType']->id)
        ->and($response->json('report.field_verifications.project_type.specific_project_type_id'))->toBe($fixture['correctedSpecific']->id)
        ->and($document->zoning_id)->toBe($fixture['encodedZoning']->id)
        ->and($document->project_type_id)->toBe($fixture['encodedType']->id)
        ->and($document->specific_project_type_id)->toBeNull()
        ->and(ProjectTypeClassification::status(
            $document,
            $response->json('report.field_verifications'),
        ))->toBe(ProjectTypeClassification::STATUS_VERIFIED_CORRECTED)
        ->and(ProjectTypeClassification::resolved(
            $document,
            $response->json('report.field_verifications'),
        ))->toBe('Warehouse — Cold Storage');
});

it('treats a matching ordinance selection as verified correct', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector);
    $document = $fixture['document'];

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'project_type' => [
                'verified' => false,
                'zoning_id' => $fixture['encodedZoning']->id,
                'project_type_id' => $fixture['encodedType']->id,
                'specific_project_type_id' => 'N/A',
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();

    expect($response->json('report.field_verifications.project_type.verified'))->toBeTrue()
        ->and($response->json('report.field_verifications.project_type.correction'))->toBeNull()
        ->and(ProjectTypeClassification::status(
            $document->fresh(),
            $response->json('report.field_verifications'),
        ))->toBe(ProjectTypeClassification::STATUS_VERIFIED_CORRECT);
});

it('rejects an invalid zoning and project type combination', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector);
    $document = $fixture['document'];

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'coordinates' => [
                'verified' => true,
                'correction' => '',
            ],
            'project_type' => [
                'verified' => false,
                'zoning_id' => $fixture['encodedZoning']->id,
                'project_type_id' => $fixture['correctedType']->id,
                'specific_project_type_id' => $fixture['correctedSpecific']->id,
            ],
        ],
        'submit' => true,
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
                'standardRrow' => '20',
                'actualRrow' => '20',
                'minSetback' => '5',
                'asPerPlan' => '6',
            ],
        ],
        'typeOfLot' => 'Interior Lot',
        'lackingDocuments' => 'N/A',
        'distanceCenterLineToBuilding' => '15',
        'inspectorSignature' => 'Zoning Inspector',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['fieldVerifications.project_type.zoning_id']);

    expect($document->fresh()->project_type_id)->toBe($fixture['encodedType']->id);
});

it('requires project type verification before submitting the evaluation report', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector);
    $document = $fixture['document'];

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
                'standardRrow' => '20',
                'actualRrow' => '20',
                'minSetback' => '5',
                'asPerPlan' => '6',
            ],
        ],
        'typeOfLot' => 'Interior Lot',
        'lackingDocuments' => 'N/A',
        'distanceCenterLineToBuilding' => '15',
        'inspectorSignature' => 'Zoning Inspector',
        'fieldVerifications' => [
            'coordinates' => [
                'verified' => true,
                'correction' => '',
            ],
            'project_type' => [
                'verified' => false,
                'correction' => 'Industrial Warehouse',
            ],
        ],
        'submit' => true,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['fieldVerifications.project_type.zoning_id']);
});

it('uses the inspector-verified project type in the locational clearance', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector, 'approved');
    $document = $fixture['document'];

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'location_details' => 'Purok 5, Brgy. Kasilak, Panabo City',
        'field_verifications' => [
            'project_type' => [
                'verified' => false,
                'correction' => 'Warehouse — Cold Storage',
                'zoning_id' => $fixture['correctedZoning']->id,
                'project_type_id' => $fixture['correctedType']->id,
                'specific_project_type_id' => $fixture['correctedSpecific']->id,
            ],
        ],
        'right_over_land' => 'Land Title',
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['projectType'])->toBe("Commercial Zone\nWarehouse\nSpecific Project Type: Cold Storage")
        ->and($document->project_type_id)->toBe($fixture['encodedType']->id)
        ->and($document->projectType?->name)->toBe('Single Detached');
});

it('uses the encoded zoning and project type on the locational clearance when verified as correct', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector, 'approved');
    $document = $fixture['document'];

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'location_details' => 'Purok 5, Brgy. Kasilak, Panabo City',
        'field_verifications' => [
            'project_type' => [
                'verified' => true,
                'correction' => null,
                'zoning_id' => null,
                'project_type_id' => null,
                'specific_project_type_id' => null,
            ],
        ],
        'right_over_land' => 'Land Title',
    ]);

    $document->load(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['projectType'])->toBe("Residential Zone\nSingle Detached")
        ->and($document->zoning_id)->toBe($fixture['encodedZoning']->id);
});

it('omits specific project type from the locational clearance when it is not applicable', function () {
    $inspector = projectTypeVerificationInspector();
    $fixture = projectTypeVerificationFixture($inspector, 'approved');
    $document = $fixture['document'];
    $correctedWithoutSpecific = ProjectType::create([
        'zoning_id' => $fixture['correctedZoning']->id,
        'name' => 'Retail stores and shops',
    ]);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'field_verifications' => [
            'project_type' => [
                'verified' => false,
                'correction' => $correctedWithoutSpecific->name,
                'zoning_id' => $fixture['correctedZoning']->id,
                'project_type_id' => $correctedWithoutSpecific->id,
                'specific_project_type_id' => null,
            ],
        ],
        'right_over_land' => 'Land Title',
    ]);

    $document->load(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['projectType'])->toBe("Commercial Zone\nRetail stores and shops")
        ->and($data['projectType'])->not->toContain('Specific Project Type:');
});
