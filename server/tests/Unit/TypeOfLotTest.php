<?php

use App\Support\TypeOfLot;

it('defines type of lot options', function () {
    expect(TypeOfLot::options())->toBe([
        'Interior Lot',
        'Inside Lot',
        'Corner Lot',
        'Through Lot',
        'Corner Through Lot',
        'End Lot',
    ]);
});
