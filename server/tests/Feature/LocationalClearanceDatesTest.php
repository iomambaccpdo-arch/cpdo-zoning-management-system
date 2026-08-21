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
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function lcDatesTestInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-lc-dates@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function lcDatesTestDocument(User $user): Document
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
        'document_title' => 'LC Dates',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-DT-0001',
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

function lcDatesLoadDocument(Document $document): Document
{
    return $document->load([
        'projectType',
        'specificProjectType',
        'barangay',
        'purok',
        'inspectionReport.inspector',
        'attachments',
    ]);
}

it('uses the inspection date from the finalized report for the combined LC date', function () {
    $inspector = lcDatesTestInspector();
    $document = lcDatesTestDocument($inspector);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => '2026-08-21 09:00:00',
        'inspection_date' => '2026-08-18',
        'right_over_land' => 'Land Title',
    ]);

    $data = app(LocationalClearanceBuilder::class)->build(lcDatesLoadDocument($document));

    expect($data)
        ->toHaveKey('dateOfInspectionAndLcPrepared', 'August 18, 2026')
        ->not->toHaveKey('dateOfInspection')
        ->not->toHaveKey('dateOfLcPrepared');
});

it('falls back to the finalized report submission date when inspection date is missing', function () {
    $inspector = lcDatesTestInspector();
    $document = lcDatesTestDocument($inspector);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => '2026-08-20 14:30:00',
        'inspection_date' => null,
        'right_over_land' => 'Land Title',
    ]);

    $data = app(LocationalClearanceBuilder::class)->build(lcDatesLoadDocument($document));

    expect($data['dateOfInspectionAndLcPrepared'])->toBe('August 20, 2026');
});

it('falls back to locational clearance generation time when the report has no dates', function () {
    $this->travelTo(Carbon::parse('2026-08-21 10:15:00'));

    $inspector = lcDatesTestInspector();
    $document = lcDatesTestDocument($inspector);

    InspectionReport::create([
        'document_id' => $document->id,
        'inspector_id' => $inspector->id,
        'status' => 'submitted',
        'submitted_at' => null,
        'inspection_date' => null,
        'right_over_land' => 'Land Title',
    ]);

    $data = app(LocationalClearanceBuilder::class)->build(lcDatesLoadDocument($document));

    expect($data['dateOfInspectionAndLcPrepared'])->toBe('August 21, 2026');
});
