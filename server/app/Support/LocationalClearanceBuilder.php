<?php

namespace App\Support;

use App\Models\Document;
use Carbon\Carbon;

class LocationalClearanceBuilder
{
    /**
     * @return array{eligible: bool, reasons: array<int, string>}
     */
    public function eligibility(Document $document): array
    {
        $reasons = [];

        if ($document->status !== 'approved') {
            $reasons[] = 'Document status must be Approved.';
        }

        $report = $document->inspectionReport;

        if (! $report || $report->status !== 'submitted') {
            $reasons[] = 'Inspection Report must be completed and submitted.';
        }

        if (! filled(trim((string) $document->oic))) {
            $reasons[] = 'Approving officer (OIC) must be assigned.';
        }

        return [
            'eligible' => $reasons === [],
            'reasons' => $reasons,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function build(Document $document): array
    {
        $report = $document->inspectionReport;
        $projectTypeParts = array_filter([
            $document->projectType?->name,
            $document->specificProjectType?->name,
        ]);

        $dateApproved = $report?->submitted_at ?? $document->updated_at;

        return [
            'applicationNumber' => $document->zoning_application_no,
            'decisionNumber' => $this->decisionNumber($document),
            'dateReceived' => $this->formatDate($document->date_of_application),
            'dateApproved' => $this->formatDate($dateApproved),
            'dateRequirementsComplied' => $this->formatDate($this->requirementsCompliedDate($document)),
            'applicantName' => $document->applicant_name,
            'corporationName' => filled($document->corporation_name) ? $document->corporation_name : '',
            'applicantAddress' => $this->formatAddress($document),
            'corporationAddress' => filled($document->corporation_address) ? $document->corporation_address : '',
            'projectType' => implode(' — ', $projectTypeParts) ?: '—',
            'location' => $this->buildLocation($document, $report),
            'floorArea' => DocumentPropertyDetails::formatFloorAreaForClearance($document),
            'lotArea' => DocumentPropertyDetails::formatLotAreaForClearance($document),
            'frontageAtMainRoad' => $report?->front_setback ?: '—',
            'typeOfLot' => $report?->type_of_lot ?: '—',
            'standardRoadRightOfWay' => $report?->road_standard_rrow ?: '—',
            'distanceCenterLineToBuilding' => $report?->distance_center_line_to_building ?: '—',
            'rightOverLand' => $report?->right_over_land ?: '—',
            'decision' => LocationalClearanceConditions::DEFAULT_DECISION,
            'conditions' => implode("\n", LocationalClearanceConditions::CONDITIONS),
            'additionalConditions' => $this->additionalConditions($report),
            'recommendingApprovalOfficer' => $this->recommendingOfficer($report),
            'approvingOfficer' => $this->approvingOfficer($document, $report),
            'orNumber' => '—',
            'amountPaid' => '—',
            'datePaid' => '—',
            'dateOfInspection' => $this->formatDate($report?->inspection_date),
            'dateOfLcPrepared' => $this->formatDate($report?->submitted_at ?? now()),
            'documentTitle' => $document->document_title,
        ];
    }

    private function decisionNumber(Document $document): string
    {
        $applicationNo = trim($document->zoning_application_no);

        if (preg_match('/(\d{4}-\d{4})\s*$/', $applicationNo, $matches)) {
            return $matches[1];
        }

        if (str_starts_with(strtoupper($applicationNo), 'LC-')) {
            return substr($applicationNo, 3);
        }

        return $applicationNo;
    }

    private function buildLocation(Document $document, ?object $report): string
    {
        $location = filled($report?->location_details)
            ? trim((string) $report->location_details)
            : $this->defaultLocation($document);

        $landmark = filled($report?->landmark)
            ? trim((string) $report->landmark)
            : '';

        if ($landmark !== '') {
            $location = "{$location} — {$landmark}";
        }

        $coordinates = trim((string) $document->coordinates);

        if ($coordinates !== '') {
            return "{$coordinates} / {$location}";
        }

        return $location;
    }

    private function defaultLocation(Document $document): string
    {
        $parts = array_filter([
            $document->purok?->name ? 'Prk. '.$document->purok->name : null,
            $document->barangay?->name ? 'Brgy. '.$document->barangay->name : null,
            'Panabo City',
        ]);

        return implode(', ', $parts) ?: '—';
    }

    private function formatAddress(Document $document): string
    {
        $parts = array_filter([
            $document->landmark,
            $document->purok?->name ? 'Purok '.$document->purok->name : null,
            $document->barangay?->name,
            'Panabo City',
        ]);

        return implode(', ', $parts) ?: '—';
    }

    private function additionalConditions(?object $report): string
    {
        if ($report && filled(trim((string) $report->additional_conditions))) {
            return trim((string) $report->additional_conditions);
        }

        return implode("\n", LocationalClearanceConditions::ADDITIONAL_CONDITIONS);
    }

    private function recommendingOfficer(?object $report): string
    {
        if (! $report) {
            return '—';
        }

        if (filled($report->recommended_for_approval_name)) {
            return $this->formatOfficerName(
                $report->recommended_for_approval_name,
                $report->recommended_for_approval_designation
            );
        }

        if (filled($report->noted_by_signature)) {
            return $this->formatOfficerName(
                $report->noted_by_signature,
                $report->noted_by_designation
            );
        }

        if (filled($report->inspector_signature)) {
            return $report->inspector_signature;
        }

        $inspector = $report->inspector ?? null;

        if ($inspector) {
            return trim("{$inspector->first_name} {$inspector->last_name}");
        }

        return '—';
    }

    private function approvingOfficer(Document $document, ?object $report): string
    {
        if ($report && filled($report->approved_by_name)) {
            return $this->formatOfficerName(
                $report->approved_by_name,
                $report->approved_by_designation
            );
        }

        return filled(trim((string) $document->oic)) ? trim((string) $document->oic) : '—';
    }

    private function formatOfficerName(string $name, mixed $designation): string
    {
        $name = trim($name);

        if (filled($designation)) {
            return "{$name}, ".trim((string) $designation);
        }

        return $name;
    }

    private function requirementsCompliedDate(Document $document): mixed
    {
        $latestDocumentAttachment = $document->attachments
            ->where('attachment_type', 'document')
            ->sortByDesc('created_at')
            ->first();

        return $latestDocumentAttachment?->created_at ?? $document->date_of_application;
    }

    private function formatDate(mixed $value): string
    {
        if (! $value) {
            return '—';
        }

        try {
            return Carbon::parse($value)->format('F j, Y');
        } catch (\Throwable) {
            return (string) $value;
        }
    }
}
