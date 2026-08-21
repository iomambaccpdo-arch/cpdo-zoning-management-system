<?php

use App\Support\Measurements;

it('formats area values with sqm and keeps the numeric value separate', function () {
    expect(Measurements::formatArea('606'))->toBe('606 sqm')
        ->and(Measurements::formatArea('120 SQ.M'))->toBe('120 sqm')
        ->and(Measurements::formatArea('250 / 175 sqm'))->toBe('250 / 175 sqm')
        ->and(Measurements::formatArea(''))->toBe('')
        ->and(Measurements::formatArea(null, '—'))->toBe('—');
});

it('formats length values with m and strips stored unit labels', function () {
    expect(Measurements::formatLength('5.39'))->toBe('5.39 m')
        ->and(Measurements::formatLength('20 Meters'))->toBe('20 m')
        ->and(Measurements::formatLength('10.00'))->toBe('10.00 m')
        ->and(Measurements::formatLength('6.5 m'))->toBe('6.5 m')
        ->and(Measurements::formatLength(null, '—'))->toBe('—');
});

it('strips area and length units for storage', function () {
    expect(Measurements::stripAreaUnit('120 square meters'))->toBe('120')
        ->and(Measurements::stripLengthUnit('60 Meters'))->toBe('60')
        ->and(Measurements::stripLengthUnit('18'))->toBe('18');
});
