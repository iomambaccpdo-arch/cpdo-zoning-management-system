<?php

namespace App\Support;

use App\Models\Document;
use App\Models\ProjectType;
use App\Models\SpecificProjectType;
use App\Models\Zoning;
use Illuminate\Validation\ValidationException;

class ProjectTypeClassification
{
    public const FIELD_KEY = 'project_type';

    public const STATUS_NOT_YET_VERIFIED = 'Not Yet Verified';

    public const STATUS_VERIFIED_CORRECT = 'Verified – Correct';

    public const STATUS_VERIFIED_CORRECTED = 'Verified – Corrected';

    public const SPECIFIC_NOT_APPLICABLE = 'N/A';

    /**
     * @return array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}
     */
    public static function encodedIds(Document $document): array
    {
        return [
            'zoning_id' => self::nullableId($document->zoning_id),
            'project_type_id' => self::nullableId($document->project_type_id),
            'specific_project_type_id' => self::nullableId($document->specific_project_type_id),
        ];
    }

    public static function encodedLabel(Document $document): string
    {
        $document->loadMissing(['projectType', 'specificProjectType']);

        return self::formatLabel(
            $document->projectType?->name,
            $document->specificProjectType?->name,
        );
    }

    /**
     * @param  array<string, mixed>|null  $verifications
     */
    public static function resolved(Document $document, ?array $verifications): string
    {
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (! is_array($entry)) {
            return self::encodedLabel($document);
        }

        if (($entry['verified'] ?? false) === true) {
            return self::encodedLabel($document);
        }

        $fromIds = self::labelFromIds(self::idsFromEntry($entry));

        if ($fromIds !== null) {
            return $fromIds;
        }

        $correction = trim((string) ($entry['correction'] ?? ''));

        return $correction !== '' ? $correction : self::encodedLabel($document);
    }

    /**
     * @param  array<string, mixed>|null  $verifications
     */
    public static function status(Document $document, ?array $verifications): string
    {
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (! is_array($entry)) {
            return self::STATUS_NOT_YET_VERIFIED;
        }

        if (($entry['verified'] ?? false) === true) {
            return self::STATUS_VERIFIED_CORRECT;
        }

        $ids = self::idsFromEntry($entry);

        if (self::isValidCombination($ids)) {
            return self::matchesEncoded($document, $ids)
                ? self::STATUS_VERIFIED_CORRECT
                : self::STATUS_VERIFIED_CORRECTED;
        }

        if (trim((string) ($entry['correction'] ?? '')) !== '') {
            return self::STATUS_VERIFIED_CORRECTED;
        }

        return self::STATUS_NOT_YET_VERIFIED;
    }

    public static function fromReport(Document $document, ?object $report): string
    {
        return self::resolvedClearance(
            $document,
            is_array($report?->field_verifications) ? $report->field_verifications : null,
        );
    }

    /**
     * Locational Clearance display: Zoning / Zone, Type of Project, and Specific Project Type.
     *
     * @param  array<string, mixed>|null  $verifications
     */
    public static function resolvedClearance(Document $document, ?array $verifications): string
    {
        $entry = is_array($verifications) ? ($verifications[self::FIELD_KEY] ?? null) : null;

        if (! is_array($entry) || ($entry['verified'] ?? false) === true) {
            return self::encodedClearanceLabel($document);
        }

        $fromIds = self::clearanceLabelFromIds(self::idsFromEntry($entry));

        if ($fromIds !== null) {
            return $fromIds;
        }

        $correction = trim((string) ($entry['correction'] ?? ''));

        return $correction !== '' ? $correction : self::encodedClearanceLabel($document);
    }

    public static function encodedClearanceLabel(Document $document): string
    {
        $document->loadMissing(['zoning', 'projectType', 'specificProjectType']);

        return self::formatClearanceLabel(
            $document->zoning?->name,
            $document->projectType?->name,
            $document->specificProjectType?->name,
        );
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array{
     *     verified: bool,
     *     correction: string|null,
     *     zoning_id: int|null,
     *     project_type_id: int|null,
     *     specific_project_type_id: int|null
     * }
     */
    public static function normalizeEntry(Document $document, mixed $entry): array
    {
        $empty = self::emptyEntry();

        if (! is_array($entry)) {
            return $empty;
        }

        if (($entry['verified'] ?? false) === true) {
            return self::verifiedCorrectEntry();
        }

        $ids = self::idsFromEntry($entry);
        $correction = trim((string) ($entry['correction'] ?? ''));

        if (self::isValidCombination($ids)) {
            if (self::matchesEncoded($document, $ids)) {
                return self::verifiedCorrectEntry();
            }

            return [
                'verified' => false,
                'correction' => self::labelFromIds($ids) ?? ($correction !== '' ? $correction : null),
                ...$ids,
            ];
        }

        return [
            'verified' => false,
            'correction' => $correction !== '' ? $correction : null,
            ...$ids,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function assertVerifiedForSubmit(Document $document, array $validated): void
    {
        $entry = $validated['fieldVerifications'][self::FIELD_KEY] ?? null;

        if (is_array($entry) && ($entry['verified'] ?? false) === true) {
            return;
        }

        $ids = is_array($entry) ? self::idsFromEntry($entry) : self::emptyIds();

        if (self::isValidCombination($ids)) {
            return;
        }

        $hasPartialSelection = $ids['zoning_id'] !== null || $ids['project_type_id'] !== null || $ids['specific_project_type_id'] !== null;

        throw ValidationException::withMessages([
            'fieldVerifications.project_type.zoning_id' => $hasPartialSelection
                ? 'The selected Zoning, Type of Project, and Specific Project Type combination is invalid.'
                : 'Verify the encoded project type or select the correct Zoning, Type of Project, and Specific Project Type from the ordinance list.',
        ]);
    }

    /**
     * @param  array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}  $ids
     */
    public static function isValidCombination(array $ids): bool
    {
        if ($ids['zoning_id'] === null || $ids['project_type_id'] === null) {
            return false;
        }

        $projectType = ProjectType::query()->find($ids['project_type_id']);

        if (! $projectType || (int) $projectType->zoning_id !== $ids['zoning_id']) {
            return false;
        }

        $hasSpecificTypes = SpecificProjectType::query()
            ->where('project_type_id', $projectType->id)
            ->exists();

        if ($hasSpecificTypes) {
            if ($ids['specific_project_type_id'] === null) {
                return false;
            }

            $specific = SpecificProjectType::query()->find($ids['specific_project_type_id']);

            return $specific !== null && (int) $specific->project_type_id === (int) $projectType->id;
        }

        return $ids['specific_project_type_id'] === null;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}
     */
    public static function idsFromEntry(array $entry): array
    {
        return [
            'zoning_id' => self::nullableId($entry['zoning_id'] ?? null),
            'project_type_id' => self::nullableId($entry['project_type_id'] ?? null),
            'specific_project_type_id' => self::nullableId($entry['specific_project_type_id'] ?? null),
        ];
    }

    /**
     * @param  array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}  $ids
     */
    public static function matchesEncoded(Document $document, array $ids): bool
    {
        $encoded = self::encodedIds($document);

        return $encoded['zoning_id'] === $ids['zoning_id']
            && $encoded['project_type_id'] === $ids['project_type_id']
            && $encoded['specific_project_type_id'] === $ids['specific_project_type_id'];
    }

    public static function formatLabel(?string $projectTypeName, ?string $specificProjectTypeName): string
    {
        $parts = array_values(array_filter([
            trim((string) $projectTypeName),
            trim((string) $specificProjectTypeName),
        ], fn (string $part) => $part !== '' && strcasecmp($part, self::SPECIFIC_NOT_APPLICABLE) !== 0));

        return $parts === [] ? '—' : implode(' — ', $parts);
    }

    public static function formatClearanceLabel(
        ?string $zoningName,
        ?string $projectTypeName,
        ?string $specificProjectTypeName,
    ): string {
        $lines = [];

        $zoning = ZoningClassification::format($zoningName);

        if ($zoning !== '' && $zoning !== '—') {
            $lines[] = $zoning;
        }

        $projectType = trim((string) $projectTypeName);

        if ($projectType !== '' && $projectType !== '—' && strcasecmp($projectType, self::SPECIFIC_NOT_APPLICABLE) !== 0) {
            $lines[] = $projectType;
        }

        $specific = trim((string) $specificProjectTypeName);

        if ($specific !== '' && strcasecmp($specific, self::SPECIFIC_NOT_APPLICABLE) !== 0) {
            $lines[] = 'Specific Project Type: '.$specific;
        }

        return $lines === [] ? '—' : implode("\n", $lines);
    }

    /**
     * @param  array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}  $ids
     */
    public static function labelFromIds(array $ids): ?string
    {
        if ($ids['project_type_id'] === null) {
            return null;
        }

        $projectType = ProjectType::query()->find($ids['project_type_id']);

        if (! $projectType) {
            return null;
        }

        $specificName = null;

        if ($ids['specific_project_type_id'] !== null) {
            $specific = SpecificProjectType::query()->find($ids['specific_project_type_id']);
            $specificName = $specific?->name;
        }

        return self::formatLabel($projectType->name, $specificName);
    }

    /**
     * @param  array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}  $ids
     */
    public static function clearanceLabelFromIds(array $ids): ?string
    {
        if ($ids['project_type_id'] === null) {
            return null;
        }

        $projectType = ProjectType::query()->with('zoning')->find($ids['project_type_id']);

        if (! $projectType) {
            return null;
        }

        $zoningName = $ids['zoning_id'] !== null
            ? (Zoning::query()->find($ids['zoning_id'])?->name ?? $projectType->zoning?->name)
            : $projectType->zoning?->name;

        $specificName = null;

        if ($ids['specific_project_type_id'] !== null) {
            $specificName = SpecificProjectType::query()->find($ids['specific_project_type_id'])?->name;
        }

        return self::formatClearanceLabel($zoningName, $projectType->name, $specificName);
    }

    /**
     * @return array{
     *     verified: bool,
     *     correction: string|null,
     *     zoning_id: int|null,
     *     project_type_id: int|null,
     *     specific_project_type_id: int|null
     * }
     */
    private static function emptyEntry(): array
    {
        return [
            'verified' => false,
            'correction' => null,
            ...self::emptyIds(),
        ];
    }

    /**
     * @return array{
     *     verified: bool,
     *     correction: string|null,
     *     zoning_id: int|null,
     *     project_type_id: int|null,
     *     specific_project_type_id: int|null
     * }
     */
    private static function verifiedCorrectEntry(): array
    {
        return [
            'verified' => true,
            'correction' => null,
            ...self::emptyIds(),
        ];
    }

    /**
     * @return array{zoning_id: int|null, project_type_id: int|null, specific_project_type_id: int|null}
     */
    private static function emptyIds(): array
    {
        return [
            'zoning_id' => null,
            'project_type_id' => null,
            'specific_project_type_id' => null,
        ];
    }

    private static function nullableId(mixed $value): ?int
    {
        if ($value === null || $value === '' || $value === self::SPECIFIC_NOT_APPLICABLE) {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $id = (int) $value;

        return $id > 0 ? $id : null;
    }
}
