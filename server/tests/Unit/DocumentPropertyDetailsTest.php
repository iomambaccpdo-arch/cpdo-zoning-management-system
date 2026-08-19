<?php

use App\Models\Document;
use App\Support\DocumentPropertyDetails;

it('normalizes buildings and lots and derives summary areas', function () {
    $details = DocumentPropertyDetails::fromRequestPayload(
        [
            ['name' => ' Tower A ', 'area' => '250'],
            ['name' => '', 'area' => ''],
            ['name' => 'Tower B', 'area' => '175'],
        ],
        [
            ['land_title' => 'TCT-AAA', 'area' => '400'],
            ['landTitle' => 'TCT-BBB', 'area' => '100'],
        ],
    );

    expect($details['buildings'])->toHaveCount(2)
        ->and($details['buildings'][0]['name'])->toBe('Tower A')
        ->and($details['lots'])->toHaveCount(2)
        ->and($details['lots'][1]['land_title'])->toBe('TCT-BBB')
        ->and($details['floor_area'])->toBe('250 / 175')
        ->and($details['lot_area'])->toBe('400 / 100');
});

it('formats area details from document buildings and lots', function () {
    $document = new Document([
        'buildings' => [
            ['name' => 'Main Building', 'area' => '120'],
            ['name' => 'Annex', 'area' => '80'],
        ],
        'lots' => [
            ['land_title' => 'TCT-111', 'area' => '300'],
        ],
        'floor_area' => '120 / 80',
        'lot_area' => '300',
    ]);

    $area = DocumentPropertyDetails::formatAreaDetails($document);

    expect($area)->toContain('Building 1: Main Building — 120 SQ.M AS PER PLAN')
        ->and($area)->toContain('Building 2: Annex — 80 SQ.M AS PER PLAN')
        ->and($area)->toContain('Lot 1: TCT-111 — 300 SQ.M');
});

it('formats clearance area labels for multiple buildings and lots', function () {
    $document = new Document([
        'buildings' => [
            ['name' => 'Main Building', 'area' => '120'],
        ],
        'lots' => [
            ['land_title' => 'TCT-111', 'area' => '300'],
            ['land_title' => 'TCT-222', 'area' => '150'],
        ],
    ]);

    expect(DocumentPropertyDetails::formatFloorAreaForClearance($document))
        ->toBe('Main Building: 120 SQUARE METERS')
        ->and(DocumentPropertyDetails::formatLotAreaForClearance($document))
        ->toContain('TCT-111: 300 SQUARE METERS')
        ->and(DocumentPropertyDetails::formatLotAreaForClearance($document))
        ->toContain('TCT-222: 150 SQUARE METERS');
});

it('formats location details from purok and barangay without document landmark', function () {
    $document = new Document([
        'landmark' => 'Near City Hall',
    ]);
    $document->setRelation('purok', new \App\Models\Purok(['name' => '5']));
    $document->setRelation('barangay', new \App\Models\Barangay(['name' => 'Kasilak']));

    expect(DocumentPropertyDetails::formatLocationDetails($document))
        ->toBe('Purok 5, Brgy. Kasilak, Panabo City')
        ->and(DocumentPropertyDetails::formatLocationDetails($document))
        ->not->toContain('Near City Hall');
});
