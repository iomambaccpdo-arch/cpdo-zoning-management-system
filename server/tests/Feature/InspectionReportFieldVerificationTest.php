<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

function fieldVerificationTestRoles(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function fieldVerificationTestInspector(): User
{
    fieldVerificationTestRoles();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-field-verification@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function fieldVerificationTestDocument(User $user): Document
{
    $zoning = Zoning::create(['name' => 'Commercial Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Warehouse',
    ]);
    $barangay = Barangay::create(['name' => 'Kasilak']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => '3',
    ]);

    return Document::create([
        'document_title' => 'Field Verification LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-FV-0001',
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Juan Dela Cruz',
        'corporation_name' => 'ABC Corp',
        'corporation_address' => 'Panabo City',
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
        'buildings' => [
            ['name' => 'Main Building', 'area' => '100'],
        ],
        'lots' => [
            ['land_title' => 'TCT-123', 'area' => '200'],
        ],
        'storey' => '2',
        'mezanine' => null,
        'status' => 'approved',
    ]);
}

it('stores field verifications on the inspection report without changing document data', function () {
    $inspector = fieldVerificationTestInspector();
    $document = fieldVerificationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'fieldVerifications' => [
            'applicant_name' => [
                'verified' => true,
                'correction' => '',
            ],
            'project_type' => [
                'verified' => false,
                'correction' => 'Industrial Warehouse',
            ],
            'location' => [
                'verified' => false,
                'correction' => 'Brgy. Kasilak, Panabo City',
            ],
            'building_0_name' => [
                'verified' => true,
                'correction' => '',
            ],
            'building_0_area' => [
                'verified' => false,
                'correction' => '120 sq.m.',
            ],
            'lot_0_land_title' => [
                'verified' => true,
                'correction' => '',
            ],
            'lot_0_area' => [
                'verified' => true,
                'correction' => '',
            ],
        ],
        'submit' => false,
    ]);

    $response->assertCreated();

    $document->refresh();

    expect($response->json('report.field_verifications.applicant_name.verified'))->toBeTrue()
        ->and($response->json('report.field_verifications.applicant_name.correction'))->toBeNull()
        ->and($response->json('report.field_verifications.project_type.verified'))->toBeFalse()
        ->and($response->json('report.field_verifications.project_type.correction'))->toBe('Industrial Warehouse')
        ->and($response->json('report.field_verifications.location.correction'))->toBe('Brgy. Kasilak, Panabo City')
        ->and($response->json('report.field_verifications.building_0_area.correction'))->toBe('120 sq.m.')
        ->and($document->applicant_name)->toBe('Juan Dela Cruz')
        ->and($document->corporation_name)->toBe('ABC Corp')
        ->and($document->buildings[0]['name'] ?? null)->toBe('Main Building')
        ->and($document->buildings[0]['area'] ?? null)->toBe('100')
        ->and($document->lots[0]['land_title'] ?? null)->toBe('TCT-123')
        ->and($document->lots[0]['area'] ?? null)->toBe('200');
});

it('clears corrections when a field is marked verified', function () {
    $inspector = fieldVerificationTestInspector();
    $document = fieldVerificationTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $create = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'fieldVerifications' => [
            'applicant_name' => [
                'verified' => false,
                'correction' => 'Pedro Santos',
            ],
        ],
        'submit' => false,
    ]);

    $create->assertCreated();
    $reportId = $create->json('report.id');

    $update = $this->putJson("/api/documents/{$document->id}/inspection-report/{$reportId}", [
        'fieldVerifications' => [
            'applicant_name' => [
                'verified' => true,
                'correction' => 'Pedro Santos',
            ],
        ],
        'submit' => false,
    ]);

    $update->assertSuccessful();

    expect($update->json('report.field_verifications.applicant_name.verified'))->toBeTrue()
        ->and($update->json('report.field_verifications.applicant_name.correction'))->toBeNull();

    $document->refresh();
    expect($document->applicant_name)->toBe('Juan Dela Cruz');
});
