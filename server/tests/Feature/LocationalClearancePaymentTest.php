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
use App\Support\DocumentStatus;
use App\Support\LocationalClearanceBuilder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Laravel\Sanctum\Sanctum;

function paymentDetailsSeed(): void
{
    (new RolesAndPermissionsSeeder)->run();
}

function paymentDetailsUser(string $roleCode, string $email): User
{
    $role = Role::where('code', $roleCode)->firstOrFail();

    $user = User::create([
        'first_name' => 'Payment',
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

function paymentDetailsDocument(User $owner, string $status = DocumentStatus::APPROVED): Document
{
    $zoning = Zoning::create(['name' => 'Residential Zone']);
    $projectType = ProjectType::create([
        'zoning_id' => $zoning->id,
        'name' => 'Single Detached',
    ]);
    $barangay = Barangay::create(['name' => 'Payment Barangay']);
    $purok = Purok::create([
        'barangay_id' => $barangay->id,
        'name' => 'Purok 1',
    ]);

    return Document::create([
        'document_title' => 'Payment LC',
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
        'status' => $status,
    ]);
}

function paymentDetailsReport(Document $document, User $inspector): InspectionReport
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
        'submission_history' => [],
    ]);
}

function paymentDetailsPayload(array $overrides = []): array
{
    return array_merge([
        'orNumber' => 'OR-2026-00123',
        'amountPaid' => '1500.50',
        'datePaid' => '2026-08-20',
        'dateRequirementsComplied' => '2026-08-18',
    ], $overrides);
}

it('lets a zoning officer enter payment and requirements details that appear on the locational clearance', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-lc@example.com');
    $inspector = paymentDetailsUser('600', 'inspector-payment-lc@example.com');
    $officer = paymentDetailsUser('700', 'officer-payment-lc@example.com');
    $document = paymentDetailsDocument($encoder);
    paymentDetailsReport($document, $inspector);

    Sanctum::actingAs($officer);

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertSuccessful()
        ->assertJsonPath('document.or_number', 'OR-2026-00123')
        ->assertJsonPath('document.amount_paid', '1500.50')
        ->assertJsonPath('data.orNumber', 'OR-2026-00123')
        ->assertJsonPath('data.amountPaid', '₱1,500.50')
        ->assertJsonPath('data.datePaid', 'August 20, 2026')
        ->assertJsonPath('data.dateRequirementsComplied', 'August 18, 2026');

    $document->refresh()->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport', 'attachments']);

    expect($document->or_number)->toBe('OR-2026-00123')
        ->and((string) $document->amount_paid)->toBe('1500.50')
        ->and($document->date_paid->toDateString())->toBe('2026-08-20')
        ->and($document->date_requirements_complied->toDateString())->toBe('2026-08-18');

    $this->postJson("/api/documents/{$document->id}/locational-clearance/generate")
        ->assertSuccessful()
        ->assertJsonPath('data.orNumber', 'OR-2026-00123')
        ->assertJsonPath('data.amountPaid', '₱1,500.50')
        ->assertJsonPath('data.datePaid', 'August 20, 2026')
        ->assertJsonPath('data.dateRequirementsComplied', 'August 18, 2026');
});

it('leaves locational clearance payment fields blank instead of fabricating defaults', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-blank@example.com');
    $inspector = paymentDetailsUser('600', 'inspector-payment-blank@example.com');
    $document = paymentDetailsDocument($encoder);
    paymentDetailsReport($document, $inspector);

    DocumentAttachment::create([
        'document_id' => $document->id,
        'file_path' => 'documents/test.pdf',
        'file_name' => 'test.pdf',
        'file_type' => 'application/pdf',
        'file_size' => 1024,
        'attachment_type' => 'document',
        'created_at' => now()->subDays(3),
    ]);

    $document->load(['projectType', 'specificProjectType', 'barangay', 'purok', 'inspectionReport', 'attachments']);

    $data = app(LocationalClearanceBuilder::class)->build($document);

    expect($data['orNumber'])->toBe('—')
        ->and($data['amountPaid'])->toBe('—')
        ->and($data['datePaid'])->toBe('—')
        ->and($data['dateRequirementsComplied'])->toBe('—');
});

it('forbids encoders from entering locational clearance payment details', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-forbid@example.com');
    $approved = paymentDetailsDocument($encoder, DocumentStatus::APPROVED);

    Sanctum::actingAs($encoder);

    $this->putJson("/api/documents/{$approved->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertForbidden();

    $encoding = paymentDetailsDocument($encoder, DocumentStatus::ENCODING);

    $this->post("/api/documents/{$encoding->id}", [
        'documentTitle' => $encoding->document_title,
        'zoning' => $encoding->zoning_id,
        'zoningApplicationNo' => $encoding->zoning_application_no,
        'typeOfProject' => $encoding->project_type_id,
        'specificProjectType' => 'N/A',
        'applicantName' => $encoding->applicant_name,
        'barangay' => $encoding->barangay_id,
        'purok' => $encoding->purok_id,
        'landmark' => $encoding->landmark,
        'floorArea' => $encoding->floor_area,
        'lotArea' => $encoding->lot_area,
        'storey' => $encoding->storey,
        'orNumber' => 'OR-SHOULD-NOT-SAVE',
        'amountPaid' => '9999',
        'datePaid' => '2026-01-01',
        'dateRequirementsComplied' => '2026-01-02',
        'saveAsDraft' => '1',
    ])->assertSuccessful();

    $encoding->refresh();

    expect($encoding->or_number)->toBeNull()
        ->and($encoding->amount_paid)->toBeNull()
        ->and($encoding->date_paid)->toBeNull()
        ->and($encoding->date_requirements_complied)->toBeNull();
});

it('forbids inspectors from entering locational clearance payment details', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-inspector@example.com');
    $inspector = paymentDetailsUser('600', 'inspector-payment-inspector@example.com');
    $document = paymentDetailsDocument($encoder, DocumentStatus::INSPECTED);
    paymentDetailsReport($document, $inspector);

    Sanctum::actingAs($inspector);

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertForbidden();
});

it('lets a zoning officer update payment details after review', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-update@example.com');
    $officer = paymentDetailsUser('700', 'officer-payment-update@example.com');
    $document = paymentDetailsDocument($encoder, DocumentStatus::REVIEWED);

    Sanctum::actingAs($officer);

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertSuccessful();

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload([
        'orNumber' => '',
        'amountPaid' => '',
        'datePaid' => '',
        'dateRequirementsComplied' => '',
    ]))->assertSuccessful();

    $document->refresh();

    expect($document->or_number)->toBeNull()
        ->and($document->amount_paid)->toBeNull()
        ->and($document->date_paid)->toBeNull()
        ->and($document->date_requirements_complied)->toBeNull();
});

it('lets a zoning officer save payment details while the application is inspected', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-inspected@example.com');
    $officer = paymentDetailsUser('700', 'officer-payment-inspected@example.com');
    $document = paymentDetailsDocument($encoder, DocumentStatus::INSPECTED);

    Sanctum::actingAs($officer);

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertSuccessful()
        ->assertJsonPath('document.or_number', 'OR-2026-00123');
});

it('forbids locational clearance payment updates before inspection', function () {
    paymentDetailsSeed();
    $encoder = paymentDetailsUser('650', 'encoder-payment-encoded@example.com');
    $officer = paymentDetailsUser('700', 'officer-payment-encoded@example.com');
    $document = paymentDetailsDocument($encoder, DocumentStatus::ENCODED);

    Sanctum::actingAs($officer);

    $this->putJson("/api/documents/{$document->id}/locational-clearance/payment", paymentDetailsPayload())
        ->assertForbidden();
});
