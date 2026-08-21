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
use Laravel\Sanctum\Sanctum;

function locationalClearanceRightOverLandInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-lc-right-over-land@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function locationalClearanceRightOverLandDocument(User $user): Document
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
        'document_title' => 'Right Over Land LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-ROL-0001',
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

it('uses the inspection report right over land value on the locational clearance', function () {
    $inspector = locationalClearanceRightOverLandInspector();
    $document = locationalClearanceRightOverLandDocument($inspector);

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Extra Judicial Settlement of Estate',
        'inspectionDate' => now()->toDateString(),
        'projectStatusAsOfInspection' => 'No Construction (0%)',
        'gpsCoordinates' => '7.123,125.456',
        'findingsEvaluation' => 'Conforming',
        'decisionRecommended' => 'For approval',
        'inspectorSignature' => 'Zoning Inspector',
    ])->assertCreated();

    $document->refresh()->load([
        'projectType',
        'specificProjectType',
        'barangay',
        'purok',
        'inspectionReport.inspector',
        'attachments',
    ]);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['rightOverLand'])->toBe('Extra Judicial Settlement of Estate')
        ->and($data['rightOverLand'])->not->toBe('Owner')
        ->and($data['rightOverLand'])->not->toBe('Lessee')
        ->and($data['rightOverLand'])->not->toBe('Leasee');
});

it('carries the verified inspection right over land text onto the locational clearance', function () {
    $inspector = locationalClearanceRightOverLandInspector();
    $document = locationalClearanceRightOverLandDocument($inspector);
    $rightOverLand = 'Extrajudicial Settlement of Estate with Deed of Absolute Sale and Affidavit of Consent';

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => now(),
        'inspection_date' => now()->toDateString(),
        'right_over_land' => $rightOverLand,
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport.inspector', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['rightOverLand'])->toBe($rightOverLand);
});
