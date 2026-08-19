<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function seedInspectionReportRoles(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function createInspectionReportInspector(): User
{
    seedInspectionReportRoles();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-dor-test@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function createInspectionReportCoordinator(): User
{
    $coordinatorRole = Role::where('code', 800)->firstOrFail();

    $user = User::create([
        'first_name' => 'Joseph',
        'last_name' => 'Raymund',
        'designation' => 'CPDC',
        'section' => 'Plans',
        'email' => 'coordinator-dor-test@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$coordinatorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function createInspectionReportDocument(User $user, string $status = 'encoded'): Document
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
        'zoning_application_no' => 'LC-2026-DOR-0001',
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

function validInspectionReportPayload(bool $submit = false): array
{
    return [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'areaDetails' => 'Lot: 200 sq.m.',
        'locationDetails' => 'Purok 1, Test Barangay',
        'inspectionDate' => '2026-07-20',
        'projectStatusAsOfInspection' => 'Ongoing (51–75%)',
        'gpsCoordinates' => '7.123,125.456',
        'abuttingNorth' => 'Residential',
        'abuttingEast' => 'Residential',
        'abuttingSouth' => 'Road',
        'abuttingWest' => 'Vacant',
        'frontages' => [[
            'name' => 'Coastal Road',
            'standardRrow' => '20 Meters',
            'actualRrow' => '20',
            'minSetback' => '5',
            'asPerPlan' => '5',
            'frontage' => '25',
        ]],
        'distanceCenterLineToBuilding' => '15',
        'parkingSpaceRequirement' => [
            'car' => '2',
            'bus' => '',
            'articulated_vehicle' => '',
            'standard_truck' => '',
            'jeepney_shuttle' => '',
        ],
        'parkingAsPerPlan' => [
            'car' => '2',
            'bus' => '',
            'articulated_vehicle' => '',
            'standard_truck' => '',
            'jeepney_shuttle' => '',
        ],
        'typeOfLot' => 'Inside Lot',
        'lackingDocuments' => 'N/A',
        'findingsEvaluation' => 'Conforming to zoning regulations.',
        'decisionRecommended' => 'FOR RECOMMENDATION OF THE APPROVING OFFICER.',
        'inspectorSignature' => 'Zoning Inspector',
        'inspectorDesignation' => 'Zoning Inspector',
        'submit' => $submit,
    ];
}

it('sets date of report from the server when an inspection report is submitted', function () {
    Carbon::setTestNow('2026-07-23 10:15:00');

    $inspector = createInspectionReportInspector();
    $document = createInspectionReportDocument($inspector, 'encoded');

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        ...validInspectionReportPayload(submit: true),
        'dateOfReport' => '2020-01-01',
    ]);

    $response->assertCreated();
    expect($response->json('report.status'))->toBe('submitted');
    expect($response->json('report.date_of_report'))->toStartWith('2026-07-23');
    expect($response->json('report.submitted_at'))->not->toBeNull();

    $report = InspectionReport::first();
    expect($report->date_of_report->format('Y-m-d'))->toBe('2026-07-23');
});

it('leaves date of report null when saving a draft', function () {
    $inspector = createInspectionReportInspector();
    $document = createInspectionReportDocument($inspector, 'encoded');

    Sanctum::actingAs($inspector);

    $response = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        validInspectionReportPayload(submit: false)
    );

    $response->assertCreated();
    expect($response->json('report.status'))->toBe('draft');
    expect($response->json('report.date_of_report'))->toBeNull();
    expect($response->json('report.submitted_at'))->toBeNull();
});

it('prevents editing a submitted inspection report', function () {
    $inspector = createInspectionReportInspector();
    $document = createInspectionReportDocument($inspector, 'encoded');

    Sanctum::actingAs($inspector);

    $created = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        validInspectionReportPayload(submit: true)
    )->assertCreated();

    $reportId = $created->json('report.id');

    $this->putJson(
        "/api/documents/{$document->id}/inspection-report/{$reportId}",
        validInspectionReportPayload(submit: false)
    )->assertForbidden();
});

it('returns a submitted report for revision and updates date of report on resubmit with audit history', function () {
    Carbon::setTestNow('2026-07-23 09:00:00');

    $inspector = createInspectionReportInspector();
    $coordinator = createInspectionReportCoordinator();
    $document = createInspectionReportDocument($inspector, 'encoded');

    Sanctum::actingAs($inspector);

    $created = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        validInspectionReportPayload(submit: true)
    )->assertCreated();

    $reportId = $created->json('report.id');
    expect($created->json('report.date_of_report'))->toStartWith('2026-07-23');

    Sanctum::actingAs($coordinator);

    $this->postJson(
        "/api/documents/{$document->id}/inspection-report/{$reportId}/return-for-revision"
    )->assertSuccessful();

    $returned = InspectionReport::findOrFail($reportId);
    expect($returned->status)->toBe('draft');
    expect($returned->submitted_at)->toBeNull();
    expect($returned->date_of_report->format('Y-m-d'))->toBe('2026-07-23');
    expect($returned->submission_history)->toHaveCount(1);
    expect($returned->submission_history[0]['date_of_report'])->toBe('2026-07-23');

    Carbon::setTestNow('2026-07-25 14:30:00');

    Sanctum::actingAs($inspector);

    $resubmitted = $this->putJson(
        "/api/documents/{$document->id}/inspection-report/{$reportId}",
        validInspectionReportPayload(submit: true)
    )->assertSuccessful();

    expect($resubmitted->json('report.status'))->toBe('submitted');
    expect($resubmitted->json('report.date_of_report'))->toStartWith('2026-07-25');

    $report = InspectionReport::findOrFail($reportId);
    expect($report->date_of_report->format('Y-m-d'))->toBe('2026-07-25');
    expect($report->submission_history)->toHaveCount(1);
    expect($report->submission_history[0]['date_of_report'])->toBe('2026-07-23');
});

it('forbids inspectors from returning a report for revision', function () {
    $inspector = createInspectionReportInspector();
    $document = createInspectionReportDocument($inspector, 'encoded');

    Sanctum::actingAs($inspector);

    $created = $this->postJson(
        "/api/documents/{$document->id}/inspection-report",
        validInspectionReportPayload(submit: true)
    )->assertCreated();

    $reportId = $created->json('report.id');

    $this->postJson(
        "/api/documents/{$document->id}/inspection-report/{$reportId}/return-for-revision"
    )->assertForbidden();
});
