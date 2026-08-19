<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\LocationalClearanceBuilder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function corporationEncoderUser(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $encoderRole = Role::where('code', 650)->firstOrFail();

    $user = User::create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'designation' => 'Encoder (Clerk)',
        'section' => 'Records Section',
        'email' => 'encoder-corp@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$encoderRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function corporationDocumentFor(User $user, array $overrides = []): Document
{
    $zoning = Zoning::create(['name' => 'Commercial Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Commercial Building',
    ]);
    $barangay = Barangay::create(['name' => 'San Francisco']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 2',
    ]);

    return Document::create(array_merge([
        'document_title' => 'LC Commercial',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-0099',
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Juan Dela Cruz',
        'corporation_name' => null,
        'corporation_address' => null,
        'received_by' => $user->fullName(),
        'received_by_user_id' => $user->id,
        'assisted_by' => null,
        'oic' => '',
        'barangay_id' => $barangay->id,
        'purok_id' => $purok->id,
        'landmark' => 'Near Plaza',
        'coordinates' => '7.123,125.456',
        'floor_area' => '100',
        'lot_area' => '200',
        'storey' => '2',
        'mezanine' => null,
        'status' => 'encoding',
    ], $overrides));
}

it('allows encoders to save corporation name and address on drafts', function () {
    $encoder = corporationEncoderUser();
    $document = corporationDocumentFor($encoder);

    Sanctum::actingAs($encoder);

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => $document->document_title,
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => $document->applicant_name,
        'corporationName' => 'Acme Development Corp.',
        'corporationAddress' => '123 Business Park, Davao City',
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'floorArea' => $document->floor_area,
        'lotArea' => $document->lot_area,
        'storey' => $document->storey,
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    $document->refresh();

    expect($document->corporation_name)->toBe('Acme Development Corp.');
    expect($document->corporation_address)->toBe('123 Business Park, Davao City');
});

it('includes corporation information in locational clearance data', function () {
    $encoder = corporationEncoderUser();
    $document = corporationDocumentFor($encoder, [
        'corporation_name' => 'Acme Development Corp.',
        'corporation_address' => '123 Business Park, Davao City',
        'oic' => 'Jane Approver',
        'status' => 'approved',
    ]);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $encoder->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['corporationName'])->toBe('Acme Development Corp.');
    expect($data['corporationAddress'])->toBe('123 Business Park, Davao City');
});

it('returns corporation fields when fetching a document', function () {
    $encoder = corporationEncoderUser();
    $document = corporationDocumentFor($encoder, [
        'corporation_name' => 'Acme Development Corp.',
        'corporation_address' => '123 Business Park, Davao City',
    ]);

    Sanctum::actingAs($encoder);

    $this->getJson("/api/documents/{$document->id}")
        ->assertSuccessful()
        ->assertJsonPath('corporation_name', 'Acme Development Corp.')
        ->assertJsonPath('corporation_address', '123 Business Park, Davao City');
});
