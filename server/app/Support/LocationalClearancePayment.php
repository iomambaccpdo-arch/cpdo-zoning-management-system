<?php

namespace App\Support;

class LocationalClearancePayment
{
    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        return [
            'orNumber' => ['nullable', 'string', 'max:100'],
            'amountPaid' => ['nullable', 'numeric', 'min:0'],
            'datePaid' => ['nullable', 'date'],
            'dateRequirementsComplied' => ['nullable', 'date'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{or_number: ?string, amount_paid: ?string, date_paid: ?string, date_requirements_complied: ?string}
     */
    public static function fromValidated(array $validated): array
    {
        $orNumber = trim((string) ($validated['orNumber'] ?? ''));

        return [
            'or_number' => $orNumber !== '' ? $orNumber : null,
            'amount_paid' => self::normalizeAmount($validated['amountPaid'] ?? null),
            'date_paid' => filled($validated['datePaid'] ?? null) ? $validated['datePaid'] : null,
            'date_requirements_complied' => filled($validated['dateRequirementsComplied'] ?? null)
                ? $validated['dateRequirementsComplied']
                : null,
        ];
    }

    public static function formatOrNumber(?string $value): string
    {
        $orNumber = trim((string) $value);

        return $orNumber !== '' ? $orNumber : '—';
    }

    public static function formatAmount(mixed $value): string
    {
        $amount = self::normalizeAmount($value);

        if ($amount === null) {
            return '—';
        }

        return '₱'.number_format((float) $amount, 2);
    }

    public static function normalizeAmount(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }
}
