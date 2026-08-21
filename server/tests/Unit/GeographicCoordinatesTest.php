<?php

use App\Support\GeographicCoordinates;

it('resolves encoded coordinates when the inspector verifies them as correct', function () {
    expect(GeographicCoordinates::resolved(
        '7.123000, 125.456000',
        ['coordinates' => ['verified' => true, 'correction' => null]],
        null,
    ))->toBe('7.123000, 125.456000')
        ->and(GeographicCoordinates::status(
            '7.123000, 125.456000',
            ['coordinates' => ['verified' => true, 'correction' => null]],
        ))->toBe(GeographicCoordinates::STATUS_VERIFIED_CORRECT);
});

it('resolves inspector corrections without using the encoded coordinates', function () {
    expect(GeographicCoordinates::resolved(
        '7.123000, 125.456000',
        ['coordinates' => ['verified' => false, 'correction' => '7.304200, 125.687300']],
        '7.123000, 125.456000',
    ))->toBe('7.304200, 125.687300')
        ->and(GeographicCoordinates::verifiedOrNull(
            '7.123000, 125.456000',
            ['coordinates' => ['verified' => false, 'correction' => '7.304200, 125.687300']],
        ))->toBe('7.304200, 125.687300')
        ->and(GeographicCoordinates::status(
            '7.123000, 125.456000',
            ['coordinates' => ['verified' => false, 'correction' => '7.304200, 125.687300']],
        ))->toBe(GeographicCoordinates::STATUS_VERIFIED_CORRECTED);
});

it('stays unverified until the inspector confirms or corrects the coordinates', function () {
    expect(GeographicCoordinates::verifiedOrNull(
        '7.123000, 125.456000',
        ['coordinates' => ['verified' => false, 'correction' => null]],
        null,
    ))->toBeNull()
        ->and(GeographicCoordinates::status(
            '7.123000, 125.456000',
            ['coordinates' => ['verified' => false, 'correction' => '']],
        ))->toBe(GeographicCoordinates::STATUS_NOT_YET_VERIFIED)
        ->and(GeographicCoordinates::resolved(
            '7.123000, 125.456000',
            null,
            null,
        ))->toBe('7.123000, 125.456000');
});
