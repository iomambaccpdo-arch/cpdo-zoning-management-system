<?php

use App\Support\RightOverLand;

it('defines right over land options', function () {
    expect(RightOverLand::options())->toBe([
        'Land Title',
        'Deed of Sale',
        'Extra Judicial Settlement of Estate',
        'Deed of Donation',
        'Affidavit of Consent',
        'Lease, Usufruct & Other Agreement',
        'Certificate of Land Ownership',
    ]);
});
