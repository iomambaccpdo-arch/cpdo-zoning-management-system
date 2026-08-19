<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\DocumentPropertyDetails;
use App\Support\LocationalClearanceBuilder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function landmarkTestRoles(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function landmarkTestInspector(): User
{
    landmarkTestRoles();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-landmark@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function landmarkTestDocument(User $user): Document
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
        'document_title' => 'Landmark LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-LM-0001',
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
        'status' => 'approved',
    ]);
}

it('saves inspector landmark without changing document location or landmark', function () {
    $inspector = landmarkTestInspector();
    $document = landmarkTestDocument($inspector);
    $originalDocumentLandmark = $document->landmark;

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'locationDetails' => 'should be ignored',
        'landmark' => 'Beside Panabo Central Elementary School',
        'submit' => false,
    ]);

    $response->assertCreated();

    $document->refresh()->load(['barangay', 'purok']);
    $expectedLocation = DocumentPropertyDetails::formatLocationDetails($document);

    expect($response->json('report.location_details'))->toBe($expectedLocation)
        ->and($response->json('report.location_details'))->toBe('Purok 5, Brgy. Kasilak, Panabo City')
        ->and($response->json('report.location_details'))->not->toContain('should be ignored')
        ->and($response->json('report.location_details'))->not->toContain('Beside Panabo Central Elementary School')
        ->and($response->json('report.landmark'))->toBe('Beside Panabo Central Elementary School')
        ->and($document->landmark)->toBe($originalDocumentLandmark)
        ->and($document->landmark)->toBe('Near City Hall');
});

it('includes inspection landmark in locational clearance location', function () {
    $inspector = landmarkTestInspector();
    $document = landmarkTestDocument($inspector);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'location_details' => DocumentPropertyDetails::formatLocationDetails($document->load(['barangay', 'purok'])),
        'landmark' => 'Along Coastal Road',
        'right_over_land' => 'Land Title',
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['location'])->toContain('Purok 5, Brgy. Kasilak, Panabo City')
        ->and($data['location'])->toContain('Along Coastal Road')
        ->and($data['location'])->not->toContain('Near City Hall');
});
