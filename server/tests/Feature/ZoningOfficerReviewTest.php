<?php

use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\DocumentStatus;
use App\Support\LocationalClearanceBuilder;
use App\Support\LocationalClearanceConditions;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function zoningReviewSeed(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function zoningReviewUser(string $roleCode, string $email): User
{
    $role = Role::where('code', $roleCode)->firstOrFail();

    $user = User::create([
        'first_name' => 'Review',
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

function zoningReviewDocument(User $owner, string $status = DocumentStatus::INSPECTED): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Single Detached',
    ]);
    $barangay = Barangay::create(['name' => 'Review Barangay']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 1',
    ]);

    return Document::create([
        'document_title' => 'Zoning Review LC',
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

function zoningReviewSubmittedReport(Document $document, User $inspector): InspectionReport
{
    return InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'date_of_report' => now()->toDateString(),
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'right_over_land' => 'Land Title',
        'type_of_lot' => 'Interior Lot',
        'road_standard_rrow' => '10.00',
        'front_setback' => '3.00',
        'distance_center_line_to_building' => '8.00',
        'noted_by_signature' => 'Legacy Noted By',
        'noted_by_designation' => 'Inspector Note',
        'submission_history' => [],
    ]);
}

function zoningReviewPayload(array $overrides = []): array
{
    return array_merge([
        'additionalConditions' => "Case-specific setback condition.\nNo commercial use beyond approved scope.",
        'recommendedForApprovalName' => 'Maria Zoning',
        'recommendedForApprovalDesignation' => 'Zoning Officer III',
        'approvedByName' => 'Pedro Coordinator',
        'approvedByDesignation' => 'CPDC',
        'reviewedReport' => UploadedFile::fake()->create('reviewed-report.pdf', 200, 'application/pdf'),
    ], $overrides);
}

it('allows a zoning officer to review with conditions, signatures, and reviewed pdf', function () {
    Storage::fake('local');
    zoningReviewSeed();

    $encoder = zoningReviewUser('650', 'encoder-zo-review@example.com');
    $inspector = zoningReviewUser('600', 'inspector-zo-review@example.com');
    $officer = zoningReviewUser('700', 'officer-zo-review@example.com');
    $document = zoningReviewDocument($encoder, DocumentStatus::INSPECTED);
    $report = zoningReviewSubmittedReport($document, $inspector);

    Sanctum::actingAs($officer);

    $response = $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/{$report->id}/review",
        zoningReviewPayload()
    );

    $response->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::REVIEWED)
        ->assertJsonPath('report.additional_conditions', "Case-specific setback condition.\nNo commercial use beyond approved scope.")
        ->assertJsonPath('report.recommended_for_approval_name', 'Maria Zoning')
        ->assertJsonPath('report.recommended_for_approval_designation', 'Zoning Officer III')
        ->assertJsonPath('report.approved_by_name', 'Pedro Coordinator')
        ->assertJsonPath('report.approved_by_designation', 'CPDC')
        ->assertJsonPath('report.reviewed_report_attachment.attachment_type', 'reviewed_inspection_report')
        ->assertJsonPath('report.reviewed_report_attachment.file_name', 'reviewed-report.pdf');

    $report->refresh();
    $document->refresh();

    expect($document->status)->toBe(DocumentStatus::REVIEWED)
        ->and($document->oic)->toBe('Pedro Coordinator')
        ->and($report->reviewed_at)->not->toBeNull()
        ->and($report->reviewed_by_user_id)->toBe($officer->id)
        ->and(DocumentAttachment::where('attachment_type', 'reviewed_inspection_report')->count())->toBe(1)
        ->and(ActivityLog::query()->where('description', 'like', '%to reviewed')->exists())->toBeTrue();

    $attachment = DocumentAttachment::where('attachment_type', 'reviewed_inspection_report')->first();
    expect(Storage::disk('local')->exists($attachment->file_path))->toBeTrue();
});

it('rejects zoning officer review without required fields or pdf', function () {
    Storage::fake('local');
    zoningReviewSeed();

    $encoder = zoningReviewUser('650', 'encoder-zo-missing@example.com');
    $inspector = zoningReviewUser('600', 'inspector-zo-missing@example.com');
    $officer = zoningReviewUser('700', 'officer-zo-missing@example.com');
    $document = zoningReviewDocument($encoder, DocumentStatus::INSPECTED);
    $report = zoningReviewSubmittedReport($document, $inspector);

    Sanctum::actingAs($officer);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/{$report->id}/review",
        [
            'additionalConditions' => '',
            'recommendedForApprovalName' => '',
            'recommendedForApprovalDesignation' => '',
            'approvedByName' => '',
            'approvedByDesignation' => '',
        ]
    )->assertUnprocessable();

    expect($document->fresh()->status)->toBe(DocumentStatus::INSPECTED);
});

it('forbids inspectors from reviewing inspection reports', function () {
    Storage::fake('local');
    zoningReviewSeed();

    $encoder = zoningReviewUser('650', 'encoder-zo-forbid@example.com');
    $inspector = zoningReviewUser('600', 'inspector-zo-forbid@example.com');
    $document = zoningReviewDocument($encoder, DocumentStatus::INSPECTED);
    $report = zoningReviewSubmittedReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/{$report->id}/review",
        zoningReviewPayload()
    )->assertForbidden();

    expect($document->fresh()->status)->toBe(DocumentStatus::INSPECTED);
});

it('includes zoning officer review fields in the locational clearance', function () {
    zoningReviewSeed();

    $encoder = zoningReviewUser('650', 'encoder-zo-lc@example.com');
    $inspector = zoningReviewUser('600', 'inspector-zo-lc@example.com');
    $document = zoningReviewDocument($encoder, DocumentStatus::APPROVED);
    $document->update(['oic' => 'Fallback OIC']);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'location_details' => 'Purok 1, Brgy. Review Barangay, Panabo City',
        'right_over_land' => 'Land Title',
        'type_of_lot' => 'Interior Lot',
        'road_standard_rrow' => '10.00',
        'front_setback' => '3.00',
        'distance_center_line_to_building' => '8.00',
        'additional_conditions' => "Officer-entered condition A.\nOfficer-entered condition B.",
        'recommended_for_approval_name' => 'Maria Zoning',
        'recommended_for_approval_designation' => 'Zoning Officer III',
        'approved_by_name' => 'Pedro Coordinator',
        'approved_by_designation' => 'CPDC',
        'noted_by_signature' => 'Should Not Appear',
        'noted_by_designation' => 'Ignored',
        'submission_history' => [],
    ]);

    $document->load([
        'projectType',
        'specificProjectType',
        'barangay',
        'purok',
        'inspectionReport.inspector',
        'attachments',
    ]);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['additionalConditions'])->toBe("Officer-entered condition A.\nOfficer-entered condition B.")
        ->and($data['additionalConditions'])->not->toBe(implode("\n", LocationalClearanceConditions::ADDITIONAL_CONDITIONS))
        ->and($data['recommendingApprovalOfficer'])->toBe('Maria Zoning, Zoning Officer III')
        ->and($data['approvingOfficer'])->toBe('Pedro Coordinator, CPDC');
});

it('clears zoning officer review data when a report is returned for revision', function () {
    Storage::fake('local');
    zoningReviewSeed();

    $encoder = zoningReviewUser('650', 'encoder-zo-return@example.com');
    $inspector = zoningReviewUser('600', 'inspector-zo-return@example.com');
    $officer = zoningReviewUser('700', 'officer-zo-return@example.com');
    $coordinator = zoningReviewUser('800', 'coordinator-zo-return@example.com');
    $document = zoningReviewDocument($encoder, DocumentStatus::INSPECTED);
    $report = zoningReviewSubmittedReport($document, $inspector);

    Sanctum::actingAs($officer);
    $this->withHeaders(['Accept' => 'application/json'])->post(
        "/api/documents/{$document->id}/inspection-report/{$report->id}/review",
        zoningReviewPayload()
    )->assertSuccessful();

    expect(DocumentAttachment::where('attachment_type', 'reviewed_inspection_report')->count())->toBe(1);

    Sanctum::actingAs($coordinator);
    $this->postJson("/api/documents/{$document->id}/inspection-report/{$report->id}/return-for-revision")
        ->assertSuccessful()
        ->assertJsonPath('document.status', DocumentStatus::ENCODED);

    $report->refresh();

    expect($report->status)->toBe('draft')
        ->and($report->additional_conditions)->toBeNull()
        ->and($report->recommended_for_approval_name)->toBeNull()
        ->and($report->approved_by_name)->toBeNull()
        ->and($report->reviewed_at)->toBeNull()
        ->and($report->reviewed_by_user_id)->toBeNull()
        ->and(DocumentAttachment::where('attachment_type', 'reviewed_inspection_report')->count())->toBe(0);
});
