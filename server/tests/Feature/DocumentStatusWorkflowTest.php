<?php

use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\InspectionReport;
use App\Models\Permission;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\DocumentStatus;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function statusWorkflowSeed(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function statusWorkflowUser(string $roleCode, string $email): User
{
    $role = Role::where('code', $roleCode)->firstOrFail();

    $user = User::create([
        'first_name' => 'Workflow',
        'last_name' => "Role{$roleCode}",
        'designation' => $role->name,
        'section' => 'Zoning Section',
        'email' => $email,
        'password' => 'password',
    ]);

    $user->roles()->sync([$role->id]);
    $user->load('roles.permissions');

    return $user;
}

function statusWorkflowDocument(User $owner, string $status = DocumentStatus::ENCODING): Document
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
        'zoning_application_no' => 'LC-2026-'.fake()->unique()->numerify('####'),
        'project_type_id' => $projectType->id,
        'specific_project_type_id' => null,
        'date_of_application' => now()->toDateString(),
        'due_date' => null,
        'applicant_name' => 'Juan Dela Cruz',
        'received_by' => $owner->fullName(),
        'received_by_user_id' => $owner->id,
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

function statusWorkflowInspectionPayload(bool $submit = true): array
{
    return [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'areaDetails' => '100 sqm',
        'locationDetails' => 'Purok 1',
        'inspectionDate' => now()->toDateString(),
        'projectStatusAsOfInspection' => 'No Construction (0%)',
        'gpsCoordinates' => '7.123,125.456',
        'abuttingNorth' => 'Residential',
        'abuttingSouth' => 'Residential',
        'abuttingEast' => 'Road',
        'abuttingWest' => 'Vacant',
        'findingsEvaluation' => 'Compliant with zoning regulations.',
        'frontages' => [
            [
                'name' => 'Quezon Street',
                'standardRrow' => '10.00',
                'actualRrow' => '10.00',
                'minSetback' => '3.00',
                'asPerPlan' => '3.00',
                'frontage' => '12.00',
            ],
        ],
        'typeOfLot' => 'Interior Lot',
        'lackingDocuments' => 'N/A',
        'distanceCenterLineToBuilding' => '8.00',
        'decisionRecommended' => 'For approval',
        'inspectorSignature' => 'Inspector Name',
        'inspectorDesignation' => 'Zoning Inspector',
        'submit' => $submit,
    ];
}

it('sets encoded when an encoder submits an application', function () {
    statusWorkflowSeed();
    $encoder = statusWorkflowUser('650', 'encoder-workflow@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::ENCODING);
    $inspector = statusWorkflowUser('600', 'inspector-workflow@example.com');

    DocumentAttachment::create([
        'document_id' => $document->id,
        'file_path' => 'documents/test.pdf',
        'file_name' => 'test.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 1024,
        'attachment_type' => 'document',
    ]);
    $document->routedToUsers()->attach($inspector->id);

    Sanctum::actingAs($encoder);

    $this->postJson("/api/documents/{$document->id}/submit")
        ->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::ENCODED);

    expect($document->fresh()->status)->toBe(DocumentStatus::ENCODED);
    expect(ActivityLog::query()->where('description', 'like', '%to encoded')->exists())->toBeTrue();
});

it('sets inspected when an inspector submits an inspection report', function () {
    statusWorkflowSeed();

    $encoder = statusWorkflowUser('650', 'encoder-inspected@example.com');
    $inspector = statusWorkflowUser('600', 'inspector-inspected@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::ENCODED);

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", statusWorkflowInspectionPayload())
        ->assertCreated()
        ->assertJsonPath('document.status', DocumentStatus::INSPECTED);

    expect($document->fresh()->status)->toBe(DocumentStatus::INSPECTED);
    expect(ActivityLog::query()->where('description', 'like', '%to inspected')->exists())->toBeTrue();
});

it('sets reviewed when a zoning officer reviews a submitted inspection report', function () {
    Storage::fake('local');
    statusWorkflowSeed();

    $encoder = statusWorkflowUser('650', 'encoder-reviewed@example.com');
    $officer = statusWorkflowUser('700', 'officer-reviewed@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::INSPECTED);

    $report = InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => statusWorkflowUser('600', 'inspector-reviewed@example.com')->id,
        'status' => 'submitted',
        'date_of_report' => now()->toDateString(),
        'submitted_at' => now(),
        'submission_history' => [],
    ]);

    Sanctum::actingAs($officer);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/{$report->id}/review",
        [
            'additionalConditions' => 'Default additional condition.',
            'recommendedForApprovalName' => 'Zoning Officer',
            'recommendedForApprovalDesignation' => 'Zoning Officer III',
            'approvedByName' => 'Coordinator Name',
            'approvedByDesignation' => 'CPDC',
            'reviewedReport' => UploadedFile::fake()->create('reviewed.pdf', 100, 'application/pdf'),
        ]
    )
        ->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::REVIEWED);

    expect($document->fresh()->status)->toBe(DocumentStatus::REVIEWED);
    expect(ActivityLog::query()->where('description', 'like', '%to reviewed')->exists())->toBeTrue();
});

it('sets approved when a coordinator approves a reviewed application', function () {
    statusWorkflowSeed();

    $encoder = statusWorkflowUser('650', 'encoder-approved@example.com');
    $coordinator = statusWorkflowUser('800', 'coordinator-approved@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::REVIEWED);

    Sanctum::actingAs($coordinator);

    $this->postJson("/api/documents/{$document->id}/approve")
        ->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::APPROVED);

    expect($document->fresh()->status)->toBe(DocumentStatus::APPROVED);
    expect(ActivityLog::query()->where('description', 'like', '%to approved')->exists())->toBeTrue();
});

it('rejects manual status updates and allows returning applications to the encoder', function () {
    statusWorkflowSeed();

    $encoder = statusWorkflowUser('650', 'encoder-return@example.com');
    $coordinator = statusWorkflowUser('800', 'coordinator-return@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::ENCODED);

    Sanctum::actingAs($coordinator);

    $this->putJson("/api/documents/{$document->id}/status", [
        'status' => 'approved',
    ])->assertNotFound();

    $this->postJson("/api/documents/{$document->id}/return-to-encoder")
        ->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::RETURNED);

    expect($document->fresh()->status)->toBe(DocumentStatus::RETURNED);
});

it('grants review and approve permissions to the expected roles', function () {
    statusWorkflowSeed();

    $officerPermissions = Role::where('code', 700)->firstOrFail()
        ->permissions()
        ->pluck('name')
        ->all();

    $coordinatorPermissions = Role::where('code', 800)->firstOrFail()
        ->permissions()
        ->pluck('name')
        ->all();

    expect($officerPermissions)->toContain('review_inspection_report');
    expect($officerPermissions)->toContain('generate_locational_clearance');
    expect($officerPermissions)->not->toContain('approve_application');
    expect($coordinatorPermissions)->toContain('review_inspection_report');
    expect($coordinatorPermissions)->toContain('approve_application');
    expect($coordinatorPermissions)->toContain('generate_locational_clearance');
    expect(Permission::where('name', 'review_inspection_report')->exists())->toBeTrue();
    expect(Permission::where('name', 'approve_application')->exists())->toBeTrue();
});

it('allows a zoning officer to generate a locational clearance for an approved application', function () {
    statusWorkflowSeed();

    $encoder = statusWorkflowUser('650', 'encoder-zo-lc@example.com');
    $inspector = statusWorkflowUser('600', 'inspector-zo-lc@example.com');
    $officer = statusWorkflowUser('700', 'officer-zo-lc@example.com');
    $document = statusWorkflowDocument($encoder, DocumentStatus::APPROVED);
    $document->update(['oic' => 'Pedro Coordinator']);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'right_over_land' => 'Land Title',
        'type_of_lot' => 'Interior Lot',
        'road_standard_rrow' => '10.00',
        'front_setback' => '3.00',
        'distance_center_line_to_building' => '8.00',
        'additional_conditions' => 'Case-specific condition.',
        'recommended_for_approval_name' => 'Maria Zoning',
        'recommended_for_approval_designation' => 'Zoning Officer III',
        'approved_by_name' => 'Pedro Coordinator',
        'approved_by_designation' => 'CPDC',
        'submission_history' => [],
    ]);

    Sanctum::actingAs($officer);

    $this->postJson("/api/documents/{$document->id}/locational-clearance/generate")
        ->assertSuccessful()
        ->assertJsonPath('data.applicationNumber', $document->zoning_application_no)
        ->assertJsonPath('data.recommendingApprovalOfficer', 'Maria Zoning, Zoning Officer III')
        ->assertJsonPath('data.approvingOfficer', 'Pedro Coordinator, CPDC');
});
