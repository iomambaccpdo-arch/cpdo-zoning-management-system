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
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function photosTestRoles(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function photosTestInspector(): User
{
    photosTestRoles();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-photos@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function photosTestDocument(User $user): Document
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
        'document_title' => 'Inspection Photos LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-PH-0001',
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

function photosTestDraftReport(Document $document, User $inspector): InspectionReport
{
    return InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'draft',
        'submission_history' => [],
    ]);
}

function photosTestImage(string $name = 'site.jpg', string $mime = 'image/jpeg'): UploadedFile
{
    return UploadedFile::fake()->create($name, 100, $mime);
}

it('rejects photo uploads when no inspection report exists', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [photosTestImage()]]
    );

    $response->assertUnprocessable()
        ->assertJsonFragment(['message' => 'Save an inspection report draft before uploading photos.']);
});

it('uploads multiple inspection photos to a draft report', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    $report = photosTestDraftReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $response = $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        [
            'files' => [
                photosTestImage('front.jpg', 'image/jpeg'),
                photosTestImage('side.png', 'image/png'),
            ],
        ]
    );

    $response->assertCreated()
        ->assertJsonPath('message', 'Inspection photos uploaded successfully.')
        ->assertJsonCount(2, 'attachments');

    expect($response->json('attachments.0.attachment_type'))->toBe('inspection_photo')
        ->and($response->json('attachments.0.inspection_report_id'))->toBe($report->id)
        ->and($response->json('attachments.1.attachment_type'))->toBe('inspection_photo');

    $this->getJson("/api/documents/{$document->id}/inspection-report/photos")
        ->assertSuccessful()
        ->assertJsonCount(2);

    expect(DocumentAttachment::where('attachment_type', 'inspection_photo')->count())->toBe(2);
});

it('rejects non-image uploads for inspection photos', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    photosTestDraftReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')]]
    )->assertUnprocessable();
});

it('rejects photo uploads when the inspection report is submitted', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    $report = photosTestDraftReport($document, $inspector);
    $report->update([
        'status' => 'submitted',
        'submitted_at' => now(),
        'date_of_report' => now()->toDateString(),
    ]);

    Sanctum::actingAs($inspector);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [photosTestImage()]]
    )->assertForbidden();
});

it('lists photos after submission and blocks delete while submitted', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    $report = photosTestDraftReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $upload = $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [photosTestImage()]]
    );

    $upload->assertCreated();
    $photoId = $upload->json('attachments.0.id');

    $report->update([
        'status' => 'submitted',
        'submitted_at' => now(),
        'date_of_report' => now()->toDateString(),
    ]);

    $this->getJson("/api/documents/{$document->id}/inspection-report/photos")
        ->assertSuccessful()
        ->assertJsonCount(1);

    $this->deleteJson("/api/documents/{$document->id}/inspection-report/photos/{$photoId}")
        ->assertForbidden();
});

it('deletes inspection photos from a draft report', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    photosTestDraftReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $upload = $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [photosTestImage()]]
    );

    $photoId = $upload->json('attachments.0.id');

    $this->deleteJson("/api/documents/{$document->id}/inspection-report/photos/{$photoId}")
        ->assertSuccessful();

    expect(DocumentAttachment::find($photoId))->toBeNull();
});

it('excludes inspection photos from document attachments and files library', function () {
    Storage::fake('local');

    $inspector = photosTestInspector();
    $document = photosTestDocument($inspector);
    photosTestDraftReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/photos",
        ['files' => [photosTestImage()]]
    )->assertCreated();

    DocumentAttachment::create([
        'document_id' => $document->id,
        'uploaded_by' => $inspector->id,
        'file_path' => 'documents/demo.pdf',
        'file_name' => 'application.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 1234,
        'attachment_type' => 'document',
    ]);

    $documentAttachments = $this->getJson("/api/documents/{$document->id}/attachments")
        ->assertSuccessful()
        ->json();

    expect(collect($documentAttachments)->pluck('attachment_type')->all())
        ->toBe(['document']);

    $library = $this->getJson('/api/attachments')
        ->assertSuccessful()
        ->json('data');

    expect(collect($library)->pluck('attachment_type')->unique()->values()->all())
        ->toBe(['document']);
});
