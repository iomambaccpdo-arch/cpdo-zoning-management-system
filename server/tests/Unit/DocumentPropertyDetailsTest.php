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

it('strips typed area units before storing building and lot areas', function () {
    $details = DocumentPropertyDetails::fromRequestPayload(
        [
            ['name' => 'Main Building', 'area' => '606 sqm'],
        ],
        [
            ['land_title' => 'TCT-111', 'area' => '400 SQ.M'],
        ],
    );

    expect($details['buildings'][0]['area'])->toBe('606')
        ->and($details['lots'][0]['area'])->toBe('400')
        ->and($details['floor_area'])->toBe('606')
        ->and($details['lot_area'])->toBe('400');
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

    expect($area)->toContain('Building 1: Main Building — 120 sqm AS PER PLAN')
        ->and($area)->toContain('Building 2: Annex — 80 sqm AS PER PLAN')
        ->and($area)->toContain('Lot 1: TCT-111 — 300 sqm');
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
        ->toBe('Main Building: 120 sqm')
        ->and(DocumentPropertyDetails::formatLotAreaForClearance($document))
        ->toContain('TCT-111: 300 sqm')
        ->and(DocumentPropertyDetails::formatLotAreaForClearance($document))
        ->toContain('TCT-222: 150 sqm');
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

it('does not duplicate Purok when the encoded purok name already includes it', function (string $encodedName) {
    expect(DocumentPropertyDetails::formatPurokName($encodedName))->toBe('Purok 10');
})->with([
    'numeric purok' => '10',
    'already prefixed' => 'Purok 10',
    'duplicated prefix' => 'Purok Purok 10',
    'abbreviated prefix' => 'Prk. 10',
]);

it('formats location details without a duplicated Purok prefix', function () {
    $document = new Document;
    $document->setRelation('purok', new \App\Models\Purok(['name' => 'Purok 10']));
    $document->setRelation('barangay', new \App\Models\Barangay(['name' => 'San Pedro']));

    expect(DocumentPropertyDetails::formatLocationDetails($document))
        ->toBe('Purok 10, Brgy. San Pedro, Panabo City')
        ->and(DocumentPropertyDetails::formatLocationDetails($document))
        ->not->toContain('Purok Purok');
});

it('collapses duplicated Purok prefixes in stored location strings', function () {
    expect(DocumentPropertyDetails::deduplicatePurokPrefix('Purok Purok 10, Brgy. San Pedro, Panabo City'))
        ->toBe('Purok 10, Brgy. San Pedro, Panabo City');
});
