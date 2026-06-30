<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\InspectionReport;
use App\Support\ActivityLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class InspectionReportController extends Controller
{
    public function show(Document $document)
    {
        $report = $document->inspectionReport()
            ->with('inspector:id,first_name,middle_name,last_name,designation')
            ->first();

        if (! $report) {
            return response()->json(['report' => null]);
        }

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

        $validated = $this->validateReport($request, $request->boolean('submit'));

        try {
            DB::beginTransaction();

            $status = $request->boolean('submit') ? 'submitted' : 'draft';

            $report = InspectionReport::create([
                ...$this->mapPayload($validated),
                'document_id' => $document->id,
                'inspector_id' => Auth::id(),
                'status' => $status,
                'submitted_at' => $status === 'submitted' ? now() : null,
            ]);

            DB::commit();

            $this->logActivity($document, $report, $status === 'submitted' ? 'submitted' : 'saved as draft');

            return response()->json([
                'message' => $status === 'submitted'
                    ? 'Inspection report submitted successfully.'
                    : 'Inspection report draft saved successfully.',
                'report' => $report->load('inspector:id,first_name,middle_name,last_name,designation'),
                'document' => $this->loadDocumentContext($document),
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

        $validated = $this->validateReport($request, $request->boolean('submit'));

        try {
            DB::beginTransaction();

            $status = $request->boolean('submit') ? 'submitted' : 'draft';

            $inspectionReport->update([
                ...$this->mapPayload($validated),
                'status' => $status,
                'submitted_at' => $status === 'submitted' ? now() : null,
            ]);

            DB::commit();

            $this->logActivity($document, $inspectionReport, $status === 'submitted' ? 'submitted' : 'updated draft');

            return response()->json([
                'message' => $status === 'submitted'
                    ? 'Inspection report submitted successfully.'
                    : 'Inspection report draft updated successfully.',
                'report' => $inspectionReport->fresh()->load('inspector:id,first_name,middle_name,last_name,designation'),
                'document' => $this->loadDocumentContext($document),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to update inspection report.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validateReport(Request $request, bool $submit): array
    {
        $rules = [
            'dateOfReport' => $submit ? 'required|date' : 'nullable|date',
            'projectLifeSpan' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'projectSignificance' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'rightOverLand' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'areaDetails' => 'nullable|string|max:10000',
            'locationDetails' => 'nullable|string|max:5000',
            'inspectionDate' => $submit ? 'required|date' : 'nullable|date',
            'projectStatusAsOfInspection' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'gpsCoordinates' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'informationProvidedInOrder' => 'nullable|string|in:yes,no',
            'informationProvidedFindings' => 'nullable|string|max:5000',
            'abuttingNorth' => 'nullable|string|max:255',
            'abuttingSouth' => 'nullable|string|max:255',
            'abuttingEast' => 'nullable|string|max:255',
            'abuttingWest' => 'nullable|string|max:255',
            'legalBases' => 'nullable|string|max:255',
            'findingsEvaluation' => $submit ? 'required|string|max:10000' : 'nullable|string|max:10000',
            'roadCategory' => 'nullable|string|max:255',
            'roadStandardRrow' => 'nullable|string|max:255',
            'roadActualRrow' => 'nullable|string|max:255',
            'roadMinSetback' => 'nullable|string|max:255',
            'roadAsPerPlan' => 'nullable|string|max:255',
            'roadRemarks' => 'nullable|string|max:5000',
            'parkingBuildingCode' => 'nullable|string|max:255',
            'parkingSpaceRequirement' => 'nullable|string|max:5000',
            'parkingRemarks' => 'nullable|string|max:5000',
            'typeOfLot' => 'nullable|string|max:255',
            'frontSetback' => 'nullable|string|max:255',
            'distanceCenterLineToBuilding' => 'nullable|string|max:255',
            'decisionRecommended' => $submit ? 'required|string|max:5000' : 'nullable|string|max:5000',
            'inspectorSignature' => $submit ? 'required|string|max:255' : 'nullable|string|max:255',
            'inspectorDesignation' => 'nullable|string|max:255',
            'notedBySignature' => 'nullable|string|max:255',
            'notedByDesignation' => 'nullable|string|max:255',
        ];

        return $request->validate($rules);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function mapPayload(array $validated): array
    {
        return [
            'date_of_report' => isset($validated['dateOfReport'])
                ? Carbon::parse($validated['dateOfReport'])->format('Y-m-d')
                : null,
            'project_life_span' => $validated['projectLifeSpan'] ?? null,
            'project_significance' => $validated['projectSignificance'] ?? null,
            'right_over_land' => $validated['rightOverLand'] ?? null,
            'area_details' => $validated['areaDetails'] ?? null,
            'location_details' => $validated['locationDetails'] ?? null,
            'inspection_date' => isset($validated['inspectionDate'])
                ? Carbon::parse($validated['inspectionDate'])->format('Y-m-d')
                : null,
            'project_status_as_of_inspection' => $validated['projectStatusAsOfInspection'] ?? null,
            'gps_coordinates' => $validated['gpsCoordinates'] ?? null,
            'information_provided_in_order' => $validated['informationProvidedInOrder'] ?? null,
            'information_provided_findings' => $validated['informationProvidedFindings'] ?? null,
            'abutting_north' => $validated['abuttingNorth'] ?? null,
            'abutting_south' => $validated['abuttingSouth'] ?? null,
            'abutting_east' => $validated['abuttingEast'] ?? null,
            'abutting_west' => $validated['abuttingWest'] ?? null,
            'legal_bases' => $validated['legalBases'] ?? null,
            'findings_evaluation' => $validated['findingsEvaluation'] ?? null,
            'road_category' => $validated['roadCategory'] ?? null,
            'road_standard_rrow' => $validated['roadStandardRrow'] ?? null,
            'road_actual_rrow' => $validated['roadActualRrow'] ?? null,
            'road_min_setback' => $validated['roadMinSetback'] ?? null,
            'road_as_per_plan' => $validated['roadAsPerPlan'] ?? null,
            'road_remarks' => $validated['roadRemarks'] ?? null,
            'parking_building_code' => $validated['parkingBuildingCode'] ?? null,
            'parking_space_requirement' => $validated['parkingSpaceRequirement'] ?? null,
            'parking_remarks' => $validated['parkingRemarks'] ?? null,
            'type_of_lot' => $validated['typeOfLot'] ?? null,
            'front_setback' => $validated['frontSetback'] ?? null,
            'distance_center_line_to_building' => $validated['distanceCenterLineToBuilding'] ?? null,
            'decision_recommended' => $validated['decisionRecommended'] ?? null,
            'inspector_signature' => $validated['inspectorSignature'] ?? null,
            'inspector_designation' => $validated['inspectorDesignation'] ?? null,
            'noted_by_signature' => $validated['notedBySignature'] ?? null,
            'noted_by_designation' => $validated['notedByDesignation'] ?? null,
        ];
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
