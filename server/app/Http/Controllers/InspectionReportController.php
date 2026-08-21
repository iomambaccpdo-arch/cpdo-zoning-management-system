<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\InspectionReport;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\DocumentAuthorization;
use App\Support\DocumentPropertyDetails;
use App\Support\DocumentStatus;
use App\Support\FrontageRoads;
use App\Support\GeographicCoordinates;
use App\Support\InspectionRecommendation;
use App\Support\Measurements;
use App\Support\ParkingSpaceRequirement;
use App\Support\ProjectStatus;
use App\Support\ProjectTypeClassification;
use App\Support\RightOverLand;
use App\Support\TypeOfLot;
use App\Support\ZoningClassification;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InspectionReportController extends Controller
{
    public function show(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! $this->canViewInspectionReport($user)) {
            return response()->json([
                'message' => 'You are not allowed to view this inspection report.',
            ], 403);
        }

        $report = $document->inspectionReport()
            ->with([
                'inspector:id,first_name,middle_name,last_name,designation',
                'reviewedReportAttachment.uploader:id,first_name,last_name',
            ])
            ->first();

        if (! $report) {
            return response()->json(['report' => null]);
        }

        $report->setAttribute(
            'frontages',
            FrontageRoads::resolve($report->frontages, [
                'road_category' => $report->road_category,
                'road_standard_rrow' => $report->road_standard_rrow,
                'road_actual_rrow' => $report->road_actual_rrow,
                'road_min_setback' => $report->road_min_setback,
                'road_as_per_plan' => $report->road_as_per_plan,
                'front_setback' => $report->front_setback,
            ])
        );

        return response()->json([
            'report' => $report,
            'document' => $this->loadDocumentContext($document),
        ]);
    }

    public function store(Request $request, Document $document)
    {
        if ($document->inspectionReport()->exists()) {
            return response()->json([
                'message' => 'An inspection report already exists for this document. Use update instead.',
            ], 409);
        }

        $submit = $request->boolean('submit');
        $validated = $this->validateReport($request, $document, $submit);

        try {
            DB::beginTransaction();

            $status = $submit ? 'submitted' : 'draft';
            $submittedAt = $submit ? now() : null;

            $report = InspectionReport::create([
                ...$this->mapPayload($validated, $document),
                'document_id' => $document->id,
                'inspector_id' => Auth::id(),
                'status' => $status,
                'date_of_report' => $submit ? now()->toDateString() : null,
                'submitted_at' => $submittedAt,
                'submission_history' => [],
            ]);

            if ($submit) {
                DocumentStatus::transition(
                    $document,
                    DocumentStatus::INSPECTED,
                    "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to inspected"
                );
            }

            DB::commit();

            $this->logActivity($document, $report, $status === 'submitted' ? 'submitted' : 'saved as draft');

            return response()->json([
                'message' => $status === 'submitted'
                    ? 'Inspection report submitted successfully.'
                    : 'Inspection report draft saved successfully.',
                'report' => $report->load('inspector:id,first_name,middle_name,last_name,designation'),
                'document' => $this->loadDocumentContext($document->fresh()),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to save inspection report.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, Document $document, InspectionReport $inspectionReport)
    {
        if ($inspectionReport->document_id !== $document->id) {
            return response()->json(['message' => 'Inspection report not found for this document.'], 404);
        }

        if ($inspectionReport->isSubmitted()) {
            return response()->json([
                'message' => 'Submitted inspection reports cannot be edited.',
            ], 403);
        }

        $submit = $request->boolean('submit');
        $validated = $this->validateReport($request, $document, $submit);

        try {
            DB::beginTransaction();

            $status = $submit ? 'submitted' : 'draft';
            $payload = [
                ...$this->mapPayload($validated, $document),
                'status' => $status,
            ];

            if ($submit) {
                $payload = [
                    ...$payload,
                    ...$this->buildSubmissionAttributes($inspectionReport),
                ];
            }

            $inspectionReport->update($payload);

            if ($submit) {
                DocumentStatus::transition(
                    $document,
                    DocumentStatus::INSPECTED,
                    "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to inspected"
                );
            }

            DB::commit();

            $this->logActivity($document, $inspectionReport, $status === 'submitted' ? 'submitted' : 'updated draft');

            return response()->json([
                'message' => $status === 'submitted'
                    ? 'Inspection report submitted successfully.'
                    : 'Inspection report draft updated successfully.',
                'report' => $inspectionReport->fresh()->load('inspector:id,first_name,middle_name,last_name,designation'),
                'document' => $this->loadDocumentContext($document->fresh()),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to update inspection report.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function returnForRevision(Document $document, InspectionReport $inspectionReport)
    {
        if ($inspectionReport->document_id !== $document->id) {
            return response()->json(['message' => 'Inspection report not found for this document.'], 404);
        }

        /** @var User $user */
        $user = Auth::user();

        if (! $this->canReturnForRevision($user)) {
            return response()->json([
                'message' => 'Only a Coordinator or Super Admin can return an inspection report for revision.',
            ], 403);
        }

        if (! $inspectionReport->isSubmitted()) {
            return response()->json([
                'message' => 'Only submitted inspection reports can be returned for revision.',
            ], 422);
        }

        try {
            DB::beginTransaction();

            $history = $inspectionReport->submission_history ?? [];
            $history[] = [
                'date_of_report' => $inspectionReport->date_of_report?->format('Y-m-d'),
                'submitted_at' => $inspectionReport->submitted_at?->toIso8601String(),
                'inspector_id' => $inspectionReport->inspector_id,
            ];

            $inspectionReport->update([
                'status' => 'draft',
                'submitted_at' => null,
                'submission_history' => $history,
                'additional_conditions' => null,
                'recommended_for_approval_name' => null,
                'recommended_for_approval_designation' => null,
                'approved_by_name' => null,
                'approved_by_designation' => null,
                'reviewed_at' => null,
                'reviewed_by_user_id' => null,
            ]);

            $this->deleteReviewedReportAttachment($inspectionReport);

            DocumentStatus::transition(
                $document,
                DocumentStatus::ENCODED,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to encoded"
            );

            DB::commit();

            $this->logActivity($document, $inspectionReport, 'returned for revision');

            return response()->json([
                'message' => 'Inspection report returned for revision.',
                'report' => $inspectionReport->fresh()->load('inspector:id,first_name,middle_name,last_name,designation'),
                'document' => $this->loadDocumentContext($document->fresh()),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to return inspection report for revision.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function review(Request $request, Document $document, InspectionReport $inspectionReport)
    {
        if ($inspectionReport->document_id !== $document->id) {
            return response()->json(['message' => 'Inspection report not found for this document.'], 404);
        }

        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canReviewInspectionReport($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to review this inspection report.',
            ], 403);
        }

        if (! $inspectionReport->isSubmitted()) {
            return response()->json([
                'message' => 'Only submitted inspection reports can be reviewed.',
            ], 422);
        }

        $validated = $request->validate([
            'additionalConditions' => 'required|string|max:10000',
            'recommendedForApprovalName' => 'required|string|max:255',
            'recommendedForApprovalDesignation' => 'required|string|max:255',
            'approvedByName' => 'required|string|max:255',
            'approvedByDesignation' => 'required|string|max:255',
            'reviewedReport' => 'required|file|mimes:pdf|max:'.config('uploads.max_file_size_kb'),
        ]);

        try {
            DB::beginTransaction();

            $inspectionReport->update([
                'additional_conditions' => trim($validated['additionalConditions']),
                'recommended_for_approval_name' => trim($validated['recommendedForApprovalName']),
                'recommended_for_approval_designation' => trim($validated['recommendedForApprovalDesignation']),
                'approved_by_name' => trim($validated['approvedByName']),
                'approved_by_designation' => trim($validated['approvedByDesignation']),
                'reviewed_at' => now(),
                'reviewed_by_user_id' => $user->id,
            ]);

            // Keep document.oic in sync so downstream approval / LC eligibility stays coherent.
            $document->update([
                'oic' => trim($validated['approvedByName']),
            ]);

            $this->storeReviewedReportAttachment(
                $document,
                $inspectionReport,
                $request->file('reviewedReport')
            );

            DocumentStatus::transition(
                $document,
                DocumentStatus::REVIEWED,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to reviewed"
            );

            DB::commit();

            $this->logActivity($document, $inspectionReport, 'reviewed');

            return response()->json([
                'message' => 'Inspection report reviewed successfully.',
                'report' => $inspectionReport->fresh()->load([
                    'inspector:id,first_name,middle_name,last_name,designation',
                    'reviewedReportAttachment.uploader:id,first_name,last_name',
                ]),
                'document' => $this->loadDocumentContext($document->fresh()),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to review inspection report.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function photos(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! $this->canViewInspectionReport($user)) {
            return response()->json([
                'message' => 'You are not allowed to view inspection report photos.',
            ], 403);
        }

        $report = $document->inspectionReport()->first();

        if (! $report) {
            return response()->json([]);
        }

        return response()->json(
            $report->photos()
                ->with('uploader:id,first_name,last_name')
                ->get()
        );
    }

    public function uploadPhotos(Request $request, Document $document)
    {
        $report = $document->inspectionReport()->first();

        if (! $report) {
            return response()->json([
                'message' => 'Save an inspection report draft before uploading photos.',
            ], 422);
        }

        if ($report->isSubmitted()) {
            return response()->json([
                'message' => 'Photos cannot be uploaded to a submitted inspection report.',
            ], 403);
        }

        $request->validate([
            'files' => 'required|array|min:1|max:'.config('uploads.max_files_per_request'),
            'files.*' => 'file|mimes:jpeg,jpg,png,webp|max:'.config('uploads.max_image_size_kb'),
        ]);

        try {
            DB::beginTransaction();

            $attachments = $this->storeInspectionPhotos($document, $report, $request->file('files'));

            DB::commit();

            ActivityLogger::log(
                'update',
                'files',
                $document->zoning_application_no,
                'Uploaded inspection photos for document: '.$document->document_title
            );

            return response()->json([
                'message' => 'Inspection photos uploaded successfully.',
                'attachments' => $attachments,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to upload inspection photos.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroyPhoto(Document $document, DocumentAttachment $attachment)
    {
        $report = $document->inspectionReport()->first();

        if (! $report || $attachment->document_id !== $document->id || ! $attachment->isInspectionPhoto()) {
            return response()->json(['message' => 'Inspection photo not found for this document.'], 404);
        }

        if ($attachment->inspection_report_id !== $report->id) {
            return response()->json(['message' => 'Inspection photo not found for this document.'], 404);
        }

        if ($report->isSubmitted()) {
            return response()->json([
                'message' => 'Photos cannot be deleted from a submitted inspection report.',
            ], 403);
        }

        try {
            $fileName = $attachment->file_name;
            Storage::disk('local')->delete($attachment->file_path);
            $attachment->delete();

            ActivityLogger::log(
                'delete',
                'files',
                $fileName,
                "Deleted inspection photo: {$fileName}"
            );

            return response()->json(['message' => 'Inspection photo deleted successfully.']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete inspection photo.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @param  array<int, \Illuminate\Http\UploadedFile>  $files
     * @return array<int, DocumentAttachment>
     */
    private function storeInspectionPhotos(Document $document, InspectionReport $report, array $files): array
    {
        $attachments = [];
        $yearMonth = Carbon::now()->format('Y/m');

        foreach ($files as $file) {
            $path = $file->store("documents/{$yearMonth}/{$document->id}/inspection/{$report->id}", 'local');

            if (! Storage::disk('local')->exists($path)) {
                throw new \RuntimeException('Failed to save uploaded inspection photo to storage.');
            }

            $attachment = $document->attachments()->create([
                'inspection_report_id' => $report->id,
                'uploaded_by' => Auth::id(),
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'attachment_type' => 'inspection_photo',
            ]);

            $attachments[] = $attachment->load('uploader:id,first_name,last_name');
        }

        return $attachments;
    }

    private function storeReviewedReportAttachment(
        Document $document,
        InspectionReport $report,
        \Illuminate\Http\UploadedFile $file
    ): DocumentAttachment {
        $this->deleteReviewedReportAttachment($report);

        $yearMonth = Carbon::now()->format('Y/m');
        $path = $file->store(
            "documents/{$yearMonth}/{$document->id}/inspection/{$report->id}/reviewed",
            'local'
        );

        if (! Storage::disk('local')->exists($path)) {
            throw new \RuntimeException('Failed to save reviewed inspection report to storage.');
        }

        return $document->attachments()->create([
            'inspection_report_id' => $report->id,
            'uploaded_by' => Auth::id(),
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'attachment_type' => 'reviewed_inspection_report',
        ]);
    }

    private function deleteReviewedReportAttachment(InspectionReport $report): void
    {
        $existing = $report->reviewedReportAttachment()->first();

        if (! $existing) {
            return;
        }

        Storage::disk('local')->delete($existing->file_path);
        $existing->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function validateReport(Request $request, Document $document, bool $submit): array
    {
        $rules = [
            'projectSignificance' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'rightOverLand' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                Rule::in(RightOverLand::options()),
            ],
            'landmark' => 'nullable|string|max:255',
            'fieldVerifications' => 'nullable|array',
            'fieldVerifications.*' => 'array',
            'fieldVerifications.*.verified' => 'required|boolean',
            'fieldVerifications.*.correction' => 'nullable|string|max:2000',
            'fieldVerifications.*.zoning_id' => 'nullable|integer|exists:zonings,id',
            'fieldVerifications.*.project_type_id' => 'nullable|integer|exists:project_types,id',
            'fieldVerifications.*.specific_project_type_id' => 'nullable|integer|exists:specific_project_types,id',
            'inspectionDate' => $submit ? 'required|date' : 'nullable|date',
            'projectStatusAsOfInspection' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                Rule::in(ProjectStatus::options()),
            ],
            'gpsCoordinates' => 'nullable|string|max:255',
            'abuttingNorth' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'abuttingSouth' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'abuttingEast' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'abuttingWest' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'findingsEvaluation' => 'nullable|string|max:10000',
            'frontages' => $submit
                ? 'required|array|min:1|max:'.FrontageRoads::MAX_ROADS
                : 'nullable|array|min:1|max:'.FrontageRoads::MAX_ROADS,
            'frontages.*.name' => 'nullable|string|max:255',
            'frontages.*.standardRrow' => 'nullable|string|max:255',
            'frontages.*.actualRrow' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'frontages.*.minSetback' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'frontages.*.asPerPlan' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'frontages.*.frontage' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'frontages.*.remarks' => 'nullable|string|max:5000',
            'frontages.0.name' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'frontages.0.standardRrow' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'frontages.0.actualRrow' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^\d+(\.\d+)?$/',
            ],
            'frontages.0.minSetback' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^\d+(\.\d+)?$/',
            ],
            'frontages.0.asPerPlan' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^\d+(\.\d+)?$/',
            ],
            'roadCategory' => 'nullable|string|max:255',
            'roadStandardRrow' => 'nullable|string|max:255',
            'roadActualRrow' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'roadMinSetback' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'roadAsPerPlan' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'roadRemarks' => 'nullable|string|max:5000',
            'parkingBuildingCode' => 'nullable|string|max:255',
            'parkingSpaceRequirement' => 'nullable|array',
            'parkingSpaceRequirement.car' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingSpaceRequirement.bus' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingSpaceRequirement.articulated_vehicle' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingSpaceRequirement.standard_truck' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingSpaceRequirement.jeepney_shuttle' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingAsPerPlan' => 'nullable|array',
            'parkingAsPerPlan.car' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingAsPerPlan.bus' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingAsPerPlan.articulated_vehicle' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingAsPerPlan.standard_truck' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingAsPerPlan.jeepney_shuttle' => ['nullable', 'string', 'max:255', 'regex:/^\d+$/'],
            'parkingRemarks' => 'nullable|string|max:5000',
            'typeOfLot' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                Rule::in(TypeOfLot::options()),
            ],
            'lackingDocuments' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'frontSetback' => ['nullable', 'string', 'max:255', 'regex:/^\d+(\.\d+)?$/'],
            'distanceCenterLineToBuilding' => [
                $submit ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^\d+(\.\d+)?$/',
            ],
            'decisionRecommended' => 'nullable|string|max:5000',
            'inspectorSignature' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'inspectorDesignation' => 'nullable|string|max:255',
            'notedBySignature' => 'nullable|string|max:255',
            'notedByDesignation' => 'nullable|string|max:255',
        ];

        $this->prepareProjectTypeVerification($request);

        $validated = $request->validate($rules);

        if ($submit) {
            $this->assertCoordinatesVerified($validated);
            ProjectTypeClassification::assertVerifiedForSubmit($document, $validated);
        }

        return $validated;
    }

    private function prepareProjectTypeVerification(Request $request): void
    {
        $verifications = $request->input('fieldVerifications');

        if (! is_array($verifications) || ! isset($verifications[ProjectTypeClassification::FIELD_KEY]) || ! is_array($verifications[ProjectTypeClassification::FIELD_KEY])) {
            return;
        }

        $specific = $verifications[ProjectTypeClassification::FIELD_KEY]['specific_project_type_id'] ?? null;

        if ($specific === ProjectTypeClassification::SPECIFIC_NOT_APPLICABLE || $specific === '') {
            $verifications[ProjectTypeClassification::FIELD_KEY]['specific_project_type_id'] = null;
            $request->merge(['fieldVerifications' => $verifications]);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assertCoordinatesVerified(array $validated): void
    {
        $entry = $validated['fieldVerifications'][GeographicCoordinates::FIELD_KEY] ?? null;
        $verified = is_array($entry) && ($entry['verified'] ?? false) === true;
        $correction = is_array($entry) ? trim((string) ($entry['correction'] ?? '')) : '';
        $gps = trim((string) ($validated['gpsCoordinates'] ?? ''));

        if ($verified || $correction !== '' || $gps !== '') {
            return;
        }

        throw ValidationException::withMessages([
            'fieldVerifications.coordinates.correction' => 'Verify the encoded coordinates or enter the actual coordinates obtained during inspection.',
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $verifications
     * @return array<string, array<string, mixed>>
     */
    private function normalizeFieldVerifications(?array $verifications, Document $document): array
    {
        if ($verifications === null) {
            return [];
        }

        $normalized = [];

        foreach ($verifications as $key => $entry) {
            if (! is_string($key) || ! is_array($entry)) {
                continue;
            }

            if ($key === ProjectTypeClassification::FIELD_KEY) {
                $normalized[$key] = ProjectTypeClassification::normalizeEntry($document, $entry);

                continue;
            }

            $verified = (bool) ($entry['verified'] ?? false);
            $correction = isset($entry['correction']) ? trim((string) $entry['correction']) : '';

            $normalized[$key] = [
                'verified' => $verified,
                'correction' => $verified || $correction === '' ? null : $correction,
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function mapPayload(array $validated, Document $document): array
    {
        $document->loadMissing(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok']);

        $frontages = array_key_exists('frontages', $validated)
            ? FrontageRoads::normalize($validated['frontages'] ?? null)
            : FrontageRoads::fromLegacy([
                'road_category' => $validated['roadCategory'] ?? null,
                'road_standard_rrow' => $validated['roadStandardRrow'] ?? null,
                'road_actual_rrow' => $validated['roadActualRrow'] ?? null,
                'road_min_setback' => $validated['roadMinSetback'] ?? null,
                'road_as_per_plan' => $validated['roadAsPerPlan'] ?? null,
                'road_remarks' => $validated['roadRemarks'] ?? null,
                'front_setback' => $validated['frontSetback'] ?? null,
            ]);

        $legacyRoadColumns = FrontageRoads::toLegacyColumns($frontages);

        $parkingSpaceRequirement = ParkingSpaceRequirement::normalize(
            $validated['parkingSpaceRequirement'] ?? null
        );
        $parkingAsPerPlan = ParkingSpaceRequirement::normalize(
            $validated['parkingAsPerPlan'] ?? null
        );

        $fieldVerifications = $this->normalizeFieldVerifications(
            $validated['fieldVerifications'] ?? null,
            $document,
        );

        $projectZoning = $this->resolvedClassification(
            ZoningClassification::format($document->zoning?->name),
            $fieldVerifications['project_classification'] ?? null,
        );
        $siteZoning = $this->resolvedClassification(
            ZoningClassification::format($document->zoning?->name),
            $fieldVerifications['site_zoning_classification'] ?? null,
        );

        $existingReport = $document->inspectionReport()->first();
        $hasPhotos = $existingReport !== null && $existingReport->photos()->exists();

        $evaluation = InspectionRecommendation::evaluate([
            'project_zoning_classification' => $projectZoning,
            'site_zoning_classification' => $siteZoning,
            'project_significance' => $validated['projectSignificance'] ?? null,
            'right_over_land' => $validated['rightOverLand'] ?? null,
            'inspection_date' => $validated['inspectionDate'] ?? null,
            'project_status_as_of_inspection' => $validated['projectStatusAsOfInspection'] ?? null,
            'has_inspection_photos' => $hasPhotos,
            'abutting_north' => $validated['abuttingNorth'] ?? null,
            'abutting_east' => $validated['abuttingEast'] ?? null,
            'abutting_south' => $validated['abuttingSouth'] ?? null,
            'abutting_west' => $validated['abuttingWest'] ?? null,
            'frontages' => $frontages,
            'distance_center_line_to_building' => Measurements::stripLengthUnit($validated['distanceCenterLineToBuilding'] ?? null),
            'parking_space_requirement' => $parkingSpaceRequirement,
            'parking_as_per_plan' => $parkingAsPerPlan,
            'type_of_lot' => $validated['typeOfLot'] ?? null,
            'lacking_documents' => $validated['lackingDocuments'] ?? null,
            'field_verifications' => $fieldVerifications,
            'coordinates_need_verification' => GeographicCoordinates::status(
                $document->coordinates,
                $fieldVerifications,
                $validated['gpsCoordinates'] ?? null,
            ) === GeographicCoordinates::STATUS_NOT_YET_VERIFIED,
        ]);
        $decisionRecommended = $evaluation['recommendation'];
        $recommendationFindings = $evaluation['findings'];

        return [
            'project_significance' => $validated['projectSignificance'] ?? null,
            'right_over_land' => $validated['rightOverLand'] ?? null,
            'area_details' => DocumentPropertyDetails::formatAreaDetails($document),
            'location_details' => DocumentPropertyDetails::formatLocationDetails($document),
            'landmark' => $validated['landmark'] ?? null,
            'field_verifications' => $fieldVerifications,
            'inspection_date' => isset($validated['inspectionDate'])
                ? Carbon::parse($validated['inspectionDate'])->format('Y-m-d')
                : null,
            'project_status_as_of_inspection' => $validated['projectStatusAsOfInspection'] ?? null,
            'gps_coordinates' => GeographicCoordinates::verifiedOrNull(
                $document->coordinates,
                $fieldVerifications,
                $validated['gpsCoordinates'] ?? null,
            ),
            'abutting_north' => $validated['abuttingNorth'] ?? null,
            'abutting_south' => $validated['abuttingSouth'] ?? null,
            'abutting_east' => $validated['abuttingEast'] ?? null,
            'abutting_west' => $validated['abuttingWest'] ?? null,
            'findings_evaluation' => $validated['findingsEvaluation'] ?? null,
            'frontages' => $frontages,
            ...$legacyRoadColumns,
            'parking_building_code' => $validated['parkingBuildingCode'] ?? null,
            'parking_space_requirement' => $parkingSpaceRequirement,
            'parking_as_per_plan' => $parkingAsPerPlan,
            'parking_remarks' => $validated['parkingRemarks'] ?? null,
            'type_of_lot' => $validated['typeOfLot'] ?? null,
            'lacking_documents' => $validated['lackingDocuments'] ?? null,
            'distance_center_line_to_building' => Measurements::stripLengthUnit($validated['distanceCenterLineToBuilding'] ?? null),
            'decision_recommended' => $decisionRecommended,
            'recommendation_findings' => $recommendationFindings,
            'inspector_signature' => $validated['inspectorSignature'] ?? null,
            'inspector_designation' => $validated['inspectorDesignation'] ?? null,
            'noted_by_signature' => $validated['notedBySignature'] ?? null,
            'noted_by_designation' => $validated['notedByDesignation'] ?? null,
        ];
    }

    /**
     * @param  array{verified?: bool, correction?: string|null}|null  $verification
     */
    private function resolvedClassification(string $encodedValue, ?array $verification): string
    {
        if ($verification === null) {
            return $encodedValue;
        }

        if (($verification['verified'] ?? false) === true) {
            return $encodedValue;
        }

        $correction = trim((string) ($verification['correction'] ?? ''));

        return $correction !== '' ? $correction : $encodedValue;
    }

    /**
     * @return array{date_of_report: string, submitted_at: \Illuminate\Support\Carbon, submission_history: array<int, array<string, mixed>>}
     */
    private function buildSubmissionAttributes(InspectionReport $report): array
    {
        $history = $report->submission_history ?? [];

        // Archive an in-flight submission only when still marked submitted
        // (return-for-revision already archives into submission_history).
        if ($report->submitted_at !== null && $report->date_of_report !== null) {
            $history[] = [
                'date_of_report' => $report->date_of_report->format('Y-m-d'),
                'submitted_at' => $report->submitted_at->toIso8601String(),
                'inspector_id' => $report->inspector_id,
            ];
        }

        return [
            'date_of_report' => now()->toDateString(),
            'submitted_at' => now(),
            'submission_history' => $history,
        ];
    }

    private function canReturnForRevision(User $user): bool
    {
        return $user->roles->contains(
            fn ($role) => in_array($role->name, ['Coordinator', 'Super Admin'], true)
        );
    }

    private function canViewInspectionReport(User $user): bool
    {
        return $user->hasResourcePermission('Files', 'inspection_report')
            || $user->hasResourcePermission('Files', 'review_inspection_report');
    }

    private function loadDocumentContext(Document $document): Document
    {
        return $document->load([
            'zoning',
            'projectType',
            'specificProjectType',
            'barangay',
            'purok',
        ]);
    }

    private function logActivity(Document $document, InspectionReport $report, string $action): void
    {
        ActivityLogger::log(
            $report->isSubmitted() ? 'update' : 'create',
            'files',
            $document->zoning_application_no,
            ucfirst($action)." inspection report for document: {$document->document_title} ({$document->zoning_application_no})"
        );
    }
}
