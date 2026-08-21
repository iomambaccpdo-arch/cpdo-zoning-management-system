<?php

use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\Document;
use App\Models\InspectionReport;
use App\Models\ProjectType;
use App\Models\Purok;
use App\Models\Role;
use App\Models\User;
use App\Models\Zoning;
use App\Support\DocumentStatus;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

function lcCopiesSeed(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function lcCopiesUser(string $roleCode, string $email): User
{
    $role = Role::where('code', $roleCode)->firstOrFail();

    $user = User::create([
        'first_name' => 'Copies',
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

function lcCopiesDocument(User $owner): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Single Detached',
    ]);
    $barangay = Barangay::create(['name' => 'Copies Barangay']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 1',
    ]);

    return Document::create([
        'document_title' => 'LC Dual Copy',
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
        'oic' => 'Pedro Coordinator',
        'barangay_id' => $barangay->id,
        'purok_id' => $purok->id,
        'landmark' => 'Near City Hall',
        'coordinates' => '7.123,125.456',
        'floor_area' => '100',
        'lot_area' => '200',
        'storey' => '2',
        'mezanine' => null,
        'status' => DocumentStatus::APPROVED,
        'or_number' => 'OR-2026-00123',
        'amount_paid' => '1500.50',
        'date_paid' => '2026-08-20',
        'date_requirements_complied' => '2026-08-18',
    ]);
}

function lcCopiesReport(Document $document, User $inspector): InspectionReport
{
    return InspectionReport::create([
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
        'recommended_for_approval_name' => 'Maria Zoning',
        'recommended_for_approval_designation' => 'Zoning Officer III',
        'approved_by_name' => 'Pedro Coordinator',
        'approved_by_designation' => 'CPDC',
        'submission_history' => [],
    ]);
}

it('finalizes a single locational clearance record that both copies share', function () {
    lcCopiesSeed();
    $encoder = lcCopiesUser('650', 'encoder-lc-copies@example.com');
    $inspector = lcCopiesUser('600', 'inspector-lc-copies@example.com');
    $officer = lcCopiesUser('700', 'officer-lc-copies@example.com');
    $document = lcCopiesDocument($encoder);
    lcCopiesReport($document, $inspector);

    Sanctum::actingAs($officer);

    $this->getJson("/api/documents/{$document->id}/locational-clearance")
        ->assertSuccessful()
        ->assertJsonPath('generated', false)
        ->assertJsonPath('generatedAt', null);

    $first = $this->postJson("/api/documents/{$document->id}/locational-clearance/generate")
        ->assertSuccessful()
        ->assertJsonPath('generated', true)
        ->assertJsonPath('data.applicationNumber', $document->zoning_application_no)
        ->assertJsonPath('data.orNumber', 'OR-2026-00123')
        ->assertJsonPath('data.amountPaid', '₱1,500.50')
        ->assertJsonPath('data.datePaid', 'August 20, 2026')
        ->assertJsonPath('document.id', $document->id);

    $generatedAt = $first->json('generatedAt');
    $decisionNumber = $first->json('data.decisionNumber');

    expect($generatedAt)->not->toBeNull();
    expect($document->fresh()->locational_clearance_generated_at)->not->toBeNull();
    expect(Document::query()->count())->toBe(1);

    $this->travel(5)->minutes();

    $second = $this->postJson("/api/documents/{$document->id}/locational-clearance/generate")
        ->assertSuccessful()
        ->assertJsonPath('generated', true)
        ->assertJsonPath('data.applicationNumber', $document->zoning_application_no)
        ->assertJsonPath('data.decisionNumber', $decisionNumber)
        ->assertJsonPath('data.orNumber', 'OR-2026-00123')
        ->assertJsonPath('document.id', $document->id);

    expect($second->json('generatedAt'))->toBe($generatedAt)
        ->and(Document::query()->count())->toBe(1)
        ->and(ActivityLog::query()->where('description', 'like', 'Generated Locational Clearance%')->count())->toBe(1);

    $this->getJson("/api/documents/{$document->id}/locational-clearance")
        ->assertSuccessful()
        ->assertJsonPath('generated', true)
        ->assertJsonPath('data.applicationNumber', $document->zoning_application_no)
        ->assertJsonPath('data.decisionNumber', $decisionNumber)
        ->assertJsonPath('data.orNumber', 'OR-2026-00123')
        ->assertJsonPath('data.amountPaid', '₱1,500.50');
});

it('reflects later payment changes in the same locational clearance record used by both copies', function () {
    lcCopiesSeed();
    $encoder = lcCopiesUser('650', 'encoder-lc-copies-pay@example.com');
    $inspector = lcCopiesUser('600', 'inspector-lc-copies-pay@example.com');
    $officer = lcCopiesUser('700', 'officer-lc-copies-pay@example.com');
    $document = lcCopiesDocument($encoder);
    lcCopiesReport($document, $inspector);

    Sanctum::actingAs($officer);

    $this->postJson("/api/documents/{$document->id}/locational-clearance/generate")
        ->assertSuccessful();

    $generatedAt = $document->fresh()->locational_clearance_generated_at;

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", [
        'orNumber' => 'OR-2026-00999',
        'amountPaid' => '2500.00',
        'datePaid' => '2026-08-21',
        'dateRequirementsComplied' => '2026-08-19',
    ])->assertSuccessful();

    $this->getJson("/api/documents/{$document->id}/locational-clearance")
        ->assertSuccessful()
        ->assertJsonPath('generated', true)
        ->assertJsonPath('data.applicationNumber', $document->zoning_application_no)
        ->assertJsonPath('data.orNumber', 'OR-2026-00999')
        ->assertJsonPath('data.amountPaid', '₱2,500.00')
        ->assertJsonPath('data.datePaid', 'August 21, 2026')
        ->assertJsonPath('data.dateRequirementsComplied', 'August 19, 2026');

    expect($document->fresh()->locational_clearance_generated_at->equalTo($generatedAt))->toBeTrue()
        ->and(Document::query()->count())->toBe(1);
});
