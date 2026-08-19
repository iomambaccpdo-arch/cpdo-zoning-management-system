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

function buildingsLotsEncoderUser(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $encoderRole = Role::where('code', 650)->firstOrFail();

    $user = User::create([
        'first_name' => 'Ana',
        'last_name' => 'Encoder',
        'designation' => 'Encoder (Clerk)',
        'section' => 'Records Section',
        'email' => 'encoder-buildings@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$encoderRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function buildingsLotsDocumentFor(User $user, array $overrides = []): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Residential Building',
    ]);
    $barangay = Barangay::create(['name' => 'New Pandan']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 5',
    ]);

    return Document::create(array_merge([
        'document_title' => 'Multi Building Application',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-0500',
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Pedro Reyes',
        'corporation_name' => null,
        'corporation_address' => null,
        'received_by' => $user->fullName(),
        'received_by_user_id' => $user->id,
        'assisted_by' => null,
        'oic' => '',
        'barangay_id' => $barangay->id,
        'purok_id' => $purok->id,
        'landmark' => 'Near Market',
        'coordinates' => '7.111,125.555',
        'buildings' => [
            ['name' => 'Main Building', 'area' => '120'],
            ['name' => 'Annex', 'area' => '80'],
        ],
        'lots' => [
            ['land_title' => 'TCT-111', 'area' => '300'],
            ['land_title' => 'TCT-222', 'area' => '150'],
        ],
        'floor_area' => '120 / 80',
        'lot_area' => '300 / 150',
        'storey' => '2',
        'mezanine' => null,
        'status' => 'encoding',
    ], $overrides));
}

it('saves multiple buildings and lots on document draft update', function () {
    $encoder = buildingsLotsEncoderUser();
    $document = buildingsLotsDocumentFor($encoder, [
        'buildings' => [['name' => 'Building 1', 'area' => '100']],
        'lots' => [['land_title' => 'TCT-000', 'area' => '200']],
        'floor_area' => '100',
        'lot_area' => '200',
    ]);

    Sanctum::actingAs($encoder);

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => $document->document_title,
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => $document->applicant_name,
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'buildings' => [
            ['name' => 'Tower A', 'area' => '250'],
            ['name' => 'Tower B', 'area' => '175'],
        ],
        'lots' => [
            ['land_title' => 'TCT-AAA', 'area' => '400'],
            ['land_title' => 'TCT-BBB', 'area' => '100'],
        ],
        'storey' => '3',
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    $document->refresh();

    expect($document->buildings)->toHaveCount(2)
        ->and($document->buildings[0]['name'])->toBe('Tower A')
        ->and($document->buildings[1]['area'])->toBe('175')
        ->and($document->lots)->toHaveCount(2)
        ->and($document->lots[1]['land_title'])->toBe('TCT-BBB')
        ->and($document->floor_area)->toBe('250 / 175')
        ->and($document->lot_area)->toBe('400 / 100');
});

it('returns buildings and lots when fetching a document', function () {
    $encoder = buildingsLotsEncoderUser();
    $document = buildingsLotsDocumentFor($encoder);

    Sanctum::actingAs($encoder);

    $this->getJson("/api/documents/{$document->id}")
        ->assertSuccessful()
        ->assertJsonPath('buildings.0.name', 'Main Building')
        ->assertJsonPath('buildings.1.area', '80')
        ->assertJsonPath('lots.0.land_title', 'TCT-111')
        ->assertJsonPath('lots.1.area', '150');
});

it('syncs inspection report area and location from the document', function () {
    $encoder = buildingsLotsEncoderUser();
    $document = buildingsLotsDocumentFor($encoder, ['status' => 'encoded']);

    $inspectorRole = Role::where('code', 600)->firstOrFail();
    $inspector = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-buildings@example.com',
        'password' => 'password',
    ]);
    $inspector->roles()->sync([$inspectorRole->id]);
    $inspector->load('roles.permissions');

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'rightOverLand' => 'Land Title',
        'areaDetails' => 'should be ignored',
        'locationDetails' => 'should be ignored',
        'submit' => false,
    ]);

    $response->assertCreated();

    $document->load(['barangay', 'purok']);
    $expectedArea = DocumentPropertyDetails::formatAreaDetails($document);
    $expectedLocation = DocumentPropertyDetails::formatLocationDetails($document);

    expect($response->json('report.area_details'))->toBe($expectedArea)
        ->and($response->json('report.location_details'))->toBe($expectedLocation)
        ->and($response->json('report.area_details'))->toContain('Main Building')
        ->and($response->json('report.area_details'))->not->toContain('should be ignored');
});

it('includes multiple buildings and lots in locational clearance data', function () {
    $encoder = buildingsLotsEncoderUser();
    $document = buildingsLotsDocumentFor($encoder, [
        'oic' => 'Jane Approver',
        'status' => 'approved',
    ]);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $encoder->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'area_details' => DocumentPropertyDetails::formatAreaDetails($document),
        'location_details' => DocumentPropertyDetails::formatLocationDetails($document->load(['barangay', 'purok'])),
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['floorArea'])->toContain('Main Building')
        ->and($data['floorArea'])->toContain('Annex')
        ->and($data['lotArea'])->toContain('TCT-111')
        ->and($data['lotArea'])->toContain('TCT-222');
});
