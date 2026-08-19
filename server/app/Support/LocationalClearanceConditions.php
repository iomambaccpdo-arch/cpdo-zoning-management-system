<?php

namespace App\Support;

final class LocationalClearanceConditions
{
    public const CONDITIONS = [
        'All conditions stipulated herein form part of this decision and are subject to monitoring.',
        'Non-compliance therewith shall be a cause for cancellation or legal action.',
        'The applicable requirements of government agencies and applicable provisions of existing laws shall be complied with.',
        'No activity other than that applied for shall be conducted within the project site.',
        'No major expansion, alteration and/or improvement shall be introduced without prior clearance from this office.',
        'This decision shall not be construed as a certification of the HLURB as to the ownership by the applicant of the parcel of land subject to this decision.',
        'Any misinterpretation, false statement or allegations material to the issuance of this decision shall be sufficient cause for its revocation.',
    ];

    public const ADDITIONAL_CONDITIONS = [
        'Provisions as to setbacks, yard requirements, bulk, easement, area, height, and other restrictions shall strictly conform with the requirements of the National Building Code and other related laws.',
        'No structure/s within the setback.',
        'The validity of this locational clearance is one (1) year and automatically revoked if the project is not commenced within the date of issuance.',
    ];

    public const DEFAULT_DECISION = 'LC- Granted and subject to the condition below:';
}
