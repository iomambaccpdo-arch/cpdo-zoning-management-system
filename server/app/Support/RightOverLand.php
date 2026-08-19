<?php

namespace App\Support;

class RightOverLand
{
    /**
     * Right over land document/authority options.
     *
     * @return list<string>
     */
    public static function options(): array
    {
        return [
            'Land Title',
            'Deed of Sale',
            'Extra Judicial Settlement of Estate',
            'Deed of Donation',
            'Affidavit of Consent',
            'Lease, Usufruct & Other Agreement',
            'Certificate of Land Ownership',
        ];
    }
}
