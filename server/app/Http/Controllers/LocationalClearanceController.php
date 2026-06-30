<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Support\ActivityLogger;
use App\Support\LocationalClearanceBuilder;
use Illuminate\Http\JsonResponse;

class LocationalClearanceController extends Controller
{
    public function __construct(private LocationalClearanceBuilder $builder) {}

    public function show(Document $document): JsonResponse
    {
        $document = $this->loadDocument($document);
        $eligibility = $this->builder->eligibility($document);

        return response()->json([
            'eligible' => $eligibility['eligible'],
            'reasons' => $eligibility['reasons'],
            'data' => $this->builder->build($document),
        ]);
    }

    public function generate(Document $document): JsonResponse
    {
        $document = $this->loadDocument($document);
        $eligibility = $this->builder->eligibility($document);

        if (! $eligibility['eligible']) {
            return response()->json([
                'message' => 'This document is not ready for Locational Clearance generation.',
                'reasons' => $eligibility['reasons'],
            ], 422);
        }

        ActivityLogger::log(
            'create',
            'files',
            $document->zoning_application_no,
            "Generated Locational Clearance for document: {$document->document_title} ({$document->zoning_application_no})"
        );

        return response()->json([
            'message' => 'Locational Clearance generated successfully.',
            'data' => $this->builder->build($document),
        ]);
    }

    private function loadDocument(Document $document): Document
    {
        return $document->load([
            'zoning',
            'projectType',
            'specificProjectType',
            'barangay',
            'purok',
            'attachments',
            'inspectionReport.inspector:id,first_name,middle_name,last_name,designation',
        ]);
    }
}
