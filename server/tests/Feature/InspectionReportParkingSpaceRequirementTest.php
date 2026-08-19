<?php

use App\Models\Barangay;
use App\Models\Document;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function parkingRequirementTestInspector(): User
{
    (new RolesAndPermissionsSeeder)->run();

    $inspectorRole = Role::where('code', 600)->firstOrFail();

    $user = User::create([
        'first_name' => 'Zoning',
        'last_name' => 'Inspector',
        'designation' => 'Zoning Inspector',
        'section' => 'Enforcement Section',
        'email' => 'inspector-parking@example.com',
        'password' => 'password',
    ]);

    $user->roles()->sync([$inspectorRole->id]);
    $user->load('roles.permissions');

    return $user;
}

function parkingRequirementTestDocument(User $user): Document
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
        'document_title' => 'Parking LC',
        'zoning_id' => $zoning->id,
        'zoning_application_no' => 'LC-2026-PK-0001',
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

it('saves structured parking space requirement by vehicle type', function () {
    $inspector = parkingRequirementTestInspector();
    $document = parkingRequirementTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $payload = [
        'car' => '2',
        'bus' => '1',
        'articulated_vehicle' => '',
        'standard_truck' => '3',
        'jeepney_shuttle' => '4',
    ];

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'projectSignificance' => 'Local Significance',
        'rightOverLand' => 'Land Title',
        'parkingSpaceRequirement' => $payload,
        'submit' => false,
    ]);

    $response->assertCreated();

    expect($response->json('report.parking_space_requirement'))->toBe([
        'car' => '2',
        'bus' => '1',
        'articulated_vehicle' => null,
        'standard_truck' => '3',
        'jeepney_shuttle' => '4',
    ]);

    $this->assertDatabaseHas('inspection_reports', [
        'document_id' => $document->id,
    ]);

    $report = $document->fresh()->inspectionReport;

    expect($report->parking_space_requirement)->toBe([
        'car' => '2',
        'bus' => '1',
        'articulated_vehicle' => null,
        'standard_truck' => '3',
        'jeepney_shuttle' => '4',
    ]);
});

it('rejects non-numeric parking space requirement values', function () {
    $inspector = parkingRequirementTestInspector();
    $document = parkingRequirementTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'parkingSpaceRequirement' => [
            'car' => 'two slots',
            'bus' => '1',
        ],
        'submit' => false,
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['parkingSpaceRequirement.car']);
});

it('rejects non-numeric setback and frontage values', function () {
    $inspector = parkingRequirementTestInspector();
    $document = parkingRequirementTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'roadActualRrow' => '6 meters',
        'roadMinSetback' => '3.0',
        'roadAsPerPlan' => 'as per plan',
        'frontSetback' => '6.0 METERS FRONT SETBACK',
        'distanceCenterLineToBuilding' => '9.25',
        'submit' => false,
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors([
            'roadActualRrow',
            'roadAsPerPlan',
            'frontSetback',
        ]);
});

it('accepts numeric setback and frontage values', function () {
    $inspector = parkingRequirementTestInspector();
    $document = parkingRequirementTestDocument($inspector);

    Sanctum::actingAs($inspector);

    $response = $this->postJson("/api/documents/{$document->id}/inspection-report", [
        'roadActualRrow' => '6.0',
        'roadMinSetback' => '3',
        'roadAsPerPlan' => '3.5',
        'frontSetback' => '6.0',
        'distanceCenterLineToBuilding' => '9.25',
        'submit' => false,
    ]);

    $response->assertCreated();

    $report = $document->fresh()->inspectionReport;

    expect($report->road_actual_rrow)->toBe('6.0')
        ->and($report->road_min_setback)->toBe('3')
        ->and($report->road_as_per_plan)->toBe('3.5')
        ->and($report->front_setback)->toBe('6.0')
        ->and($report->distance_center_line_to_building)->toBe('9.25');
});
