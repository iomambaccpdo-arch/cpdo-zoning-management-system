<?php

use App\Support\LocationalClearancePayment;

it('formats blank payment values as em dashes instead of fabricated defaults', function () {
    expect(LocationalClearancePayment::formatOrNumber(null))->toBe('—')
        ->and(LocationalClearancePayment::formatOrNumber(''))->toBe('—')
        ->and(LocationalClearancePayment::formatOrNumber('   '))->toBe('—')
        ->and(LocationalClearancePayment::formatAmount(null))->toBe('—')
        ->and(LocationalClearancePayment::formatAmount(''))->toBe('—');
});

it('formats officer-entered official receipt values for the locational clearance', function () {
    expect(LocationalClearancePayment::formatOrNumber(' OR-2026-00123 '))->toBe('OR-2026-00123')
        ->and(LocationalClearancePayment::formatAmount('1500.5'))->toBe('₱1,500.50')
        ->and(LocationalClearancePayment::fromValidated([
            'orNumber' => ' OR-9 ',
            'amountPaid' => '100',
            'datePaid' => '2026-08-20',
            'dateRequirementsComplied' => '',
        ]))->toMatchArray([
            'or_number' => 'OR-9',
            'amount_paid' => '100.00',
            'date_paid' => '2026-08-20',
            'date_requirements_complied' => null,
        ]);
});
