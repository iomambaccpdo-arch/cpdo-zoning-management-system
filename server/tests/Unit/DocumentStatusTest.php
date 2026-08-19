<?php

use App\Support\DocumentStatus;

it('lists the automated workflow statuses', function () {
    expect(DocumentStatus::all())->toBe([
        'encoding',
        'returned',
        'encoded',
        'inspected',
        'reviewed',
        'approved',
    ]);
});

it('maps legacy statuses onto the automated workflow', function (string $legacy, string $expected) {
    expect(DocumentStatus::migrateLegacy($legacy))->toBe($expected);
})->with([
    ['pending', 'encoded'],
    ['processing', 'inspected'],
    ['completed', 'approved'],
    ['finalized', 'approved'],
    ['encoding', 'encoding'],
    ['returned', 'returned'],
]);

it('identifies encoder draft and overdue-eligible statuses', function () {
    expect(DocumentStatus::encodingDrafts())->toBe(['encoding', 'returned']);
    expect(DocumentStatus::overdueEligible())->toBe(['encoded', 'inspected', 'reviewed']);
});
