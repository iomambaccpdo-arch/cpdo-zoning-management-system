<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\Permission;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function createEncoderUser(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $encoderRole = Role::where('code', 650)->firstOrFail();

    $user = User::create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'designation' => 'Encoder (Clerk)',
        'section' => 'Records Section',
        'email' => 'encoder-test@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$encoderRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function createCoordinatorUser(): User
{
    $coordinatorRole = Role::where('code', 800)->firstOrFail();

    $user = User::create([
        'first_name' => 'Joseph',
        'last_name' => 'Raymund',
        'designation' => 'CPDC',
        'section' => 'Plans',
        'email' => 'coordinator-test@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$coordinatorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function createDocumentForUser(User $user, string $status = 'encoding'): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Single Detached',
    ]);
    $barangay = Barangay::create(['name' => 'Test Barangay']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 1',
    ]);

    return Document::create([
        'document_title' => 'LC Area',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-0001',
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Juan Dela Cruz',
        'received_by' => $user->fullName(),
        'received_by_user_id' => $user->id,
        'assisted_by' => null,
        'oic' => '',
        'barangay_id' => $barangay->id,
        'purok_id' => $purok->id,
        'landmark' => 'Near City Hall',
        'coordinates' => '7.123,125.456',
        'floor_area' => '100',
        'lot_area' => '200',
        'storey' => '2',
        'mezanine' => null,
        'status' => $status,
    ]);
}

it('scopes document listings to applications encoded by the encoder', function () {
    $encoder = createEncoderUser();
    $otherEncoder = User::create([
        'first_name' => 'Other',
        'last_name' => 'Encoder',
        'designation' => 'Encoder (Clerk)',
        'section' => 'Records Section',
        'email' => 'other-encoder@example.com',
        'password' => 'password',
    ]);
    $otherEncoder->roles()->sync([Role::where('code', 650)->value('id')]);

    $ownDocument = createDocumentForUser($encoder, 'encoding');
    createDocumentForUser($otherEncoder, 'encoding');

    Sanctum::actingAs($encoder);

    $response = $this->getJson('/api/documents');

    $response->assertSuccessful();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.id'))->toBe($ownDocument->id);
});

it('allows encoders to update only encoding or returned applications they created', function () {
    $encoder = createEncoderUser();
    $document = createDocumentForUser($encoder, 'encoding');

    Sanctum::actingAs($encoder);

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => 'LC Building',
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => 'Updated Applicant',
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'floorArea' => $document->floor_area,
        'lotArea' => $document->lot_area,
        'storey' => $document->storey,
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    expect($document->fresh()->applicant_name)->toBe('Updated Applicant');
    expect($document->fresh()->status)->toBe('encoding');

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => 'LC Building',
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => 'Updated Applicant',
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'coordinates' => '7.304200, 125.687300',
        'floorArea' => $document->floor_area,
        'lotArea' => $document->lot_area,
        'storey' => $document->storey,
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    expect($document->fresh()->coordinates)->toBe('7.304200, 125.687300');

    $document->update(['status' => 'encoded']);

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => 'LC Building',
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => 'Should Not Update',
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'floorArea' => $document->floor_area,
        'lotArea' => $document->lot_area,
        'storey' => $document->storey,
    ])->assertForbidden();
});

it('forbids encoders from deleting applications or returning them', function () {
    $encoder = createEncoderUser();
    $document = createDocumentForUser($encoder, 'encoding');

    Sanctum::actingAs($encoder);

    $this->delete("/api/documents/{$document->id}")->assertForbidden();

    $this->postJson("/api/documents/{$document->id}/return-to-encoder")
        ->assertForbidden();
});

it('grants encoder clerk the expected file permissions only', function () {
    createEncoderUser();

    $encoderRole = Role::where('code', 650)->firstOrFail();
    $permissions = $encoderRole->permissions()
        ->get(['resource', 'name'])
        ->map(fn (Permission $permission) => "{$permission->resource}:{$permission->name}")
        ->sort()
        ->values()
        ->all();

    expect($permissions)->toBe([
        'Dashboard:view',
        'Files:create',
        'Files:submit_application',
        'Files:update',
        'Files:view',
    ]);
});

it('allows coordinators to return applications to the encoder', function () {
    createEncoderUser();
    $coordinator = createCoordinatorUser();
    $encoder = User::where('email', 'encoder-test@example.com')->firstOrFail();
    $document = createDocumentForUser($encoder, 'encoding');

    Sanctum::actingAs($coordinator);

    $this->postJson("/api/documents/{$document->id}/return-to-encoder")
        ->assertSuccessful();

    expect($document->fresh()->status)->toBe('returned');
});

it('keeps encoder coordinates read-only after encoding even when the application is returned', function () {
    $encoder = createEncoderUser();
    $document = createDocumentForUser($encoder, 'returned');
    $originalCoordinates = $document->coordinates;

    Sanctum::actingAs($encoder);

    $this->post("/api/documents/{$document->id}", [
        'documentTitle' => $document->document_title,
        'zoning' => $document->zoning_id,
        'zoningApplicationNo' => $document->zoning_application_no,
        'typeOfProject' => $document->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => 'Corrected Applicant',
        'barangay' => $document->barangay_id,
        'purok' => $document->purok_id,
        'landmark' => $document->landmark,
        'coordinates' => '7.999000, 125.999000',
        'floorArea' => $document->floor_area,
        'lotArea' => $document->lot_area,
        'storey' => $document->storey,
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    $document->refresh();

    expect($document->applicant_name)->toBe('Corrected Applicant')
        ->and($document->coordinates)->toBe($originalCoordinates)
        ->and($document->coordinates)->toBe('7.123,125.456');
});
