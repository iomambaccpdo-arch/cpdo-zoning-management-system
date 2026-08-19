<?php

use App\Support\ZoningClassification;

it('strips section and regulations prefixes from zoning labels', function () {
    expect(ZoningClassification::format('Section 12.11. Regulations in Commercial-1 (C-1) Zone'))
        ->toBe('Commercial-1 (C-1) Zone');

    expect(ZoningClassification::format('Section 12.16. Regulations in Industrial-3 (1-3) Zone'))
        ->toBe('Industrial-3 (I-3) Zone');

    expect(ZoningClassification::format('Section 12.1.3. Special Use Sub-Zone'))
        ->toBe('Special Use Sub-Zone');
});

it('leaves already normalized zoning names unchanged', function () {
    expect(ZoningClassification::format('Commercial-1 (C-1) Zone'))
        ->toBe('Commercial-1 (C-1) Zone');

    expect(ZoningClassification::format('Industrial-3 (I-3) Zone'))
        ->toBe('Industrial-3 (I-3) Zone');
});

it('returns an empty string for blank input', function () {
    expect(ZoningClassification::format(null))->toBe('');
    expect(ZoningClassification::format('   '))->toBe('');
});
