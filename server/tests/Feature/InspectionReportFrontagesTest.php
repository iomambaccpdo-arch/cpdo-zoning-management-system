<?php

use App\Models\Barangay;
use App\Models\Document;
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

function frontagesTestInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-frontages@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function frontagesTestDocument(User $user): Document
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
        'document_title' => 'Frontage LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-FG-0001',
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

it('saves main road and optional additional frontage roads', function () {
    $inspector = frontagesTestInspector();
    $document = frontagesTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'inspectionDate' => now()->toDateString(),
        'projectStatusAsOfInspection' => 'No Construction (0%)',
        'gpsCoordinates' => '7.123,125.456',
        'findingsEvaluation' => 'Conforming',
        'frontages' => [
            [
                'name' => 'Coastal Road',
                'standardRrow' => '20 Meters',
                'actualRrow' => '18',
                'minSetback' => '5',
                'asPerPlan' => '5',
                'frontage' => '25.5',
                'remarks' => 'Main frontage',
            ],
            [
                'name' => 'Brgy. Road',
                'standardRrow' => '8 Meters',
                'actualRrow' => '8',
                'minSetback' => '2',
                'asPerPlan' => '2',
                'frontage' => '10',
                'remarks' => 'Corner side',
            ],
        ],
        'decisionRecommended' => 'For approval',
        'inspectorSignature' => 'Zoning Inspector',
    ])->assertCreated();

    expect($response->json('report.frontages'))->toHaveCount(2)
        ->and($response->json('report.frontages.0.label'))->toBe('Main Road')
        ->and($response->json('report.frontages.0.name'))->toBe('Coastal Road')
        ->and($response->json('report.frontages.0.frontage'))->toBe('25.5')
        ->and($response->json('report.frontages.0.standard_rrow'))->toBe('20')
        ->and($response->json('report.frontages.1.label'))->toBe('2nd Road')
        ->and($response->json('report.frontages.1.name'))->toBe('Brgy. Road')
        ->and($response->json('report.road_category'))->toBe('Coastal Road')
        ->and($response->json('report.front_setback'))->toBe('25.5')
        ->and($response->json('report.frontages.0.remarks'))->toBe('Main frontage');

    $document->refresh()->load([
        'projectType',
        'specificProjectType',
        'barangay',
        'purok',
        'inspectionReport.inspector',
        'attachments',
    ]);

    $clearance = app(LocationalClearanceBuilder::class)->build($document);

    expect($clearance['frontageAtMainRoad'])->toBe('25.5 m')
        ->and($clearance['standardRoadRightOfWay'])->toBe('20 m');
});

it('rejects more than four frontage roads', function () {
    $inspector = frontagesTestInspector();
    $document = frontagesTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'frontages' => [
            ['name' => 'Road 1'],
            ['name' => 'Road 2'],
            ['name' => 'Road 3'],
            ['name' => 'Road 4'],
            ['name' => 'Road 5'],
        ],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['frontages']);
});

it('rejects non-numeric frontage measurements', function () {
    $inspector = frontagesTestInspector();
    $document = frontagesTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'frontages' => [
            [
                'name' => 'Coastal Road',
                'frontage' => 'twelve meters',
                'actualRrow' => '6.0',
            ],
        ],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['frontages.0.frontage']);
});

it('still accepts legacy flat road fields when frontages is omitted', function () {
    $inspector = frontagesTestInspector();
    $document = frontagesTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'roadCategory' => 'Legacy Road',
        'roadStandardRrow' => '6 Meters',
        'roadActualRrow' => '6.0',
        'roadMinSetback' => '3',
        'roadAsPerPlan' => '3.5',
        'roadRemarks' => 'From legacy payload',
        'frontSetback' => '14',
    ])->assertCreated();

    expect($response->json('report.frontages.0.name'))->toBe('Legacy Road')
        ->and($response->json('report.frontages.0.frontage'))->toBe('14')
        ->and($response->json('report.road_category'))->toBe('Legacy Road')
        ->and($response->json('report.front_setback'))->toBe('14');
});
