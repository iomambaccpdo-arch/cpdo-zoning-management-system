<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\DocumentAuthorization;
use App\Support\LocationalClearanceBuilder;
use App\Support\LocationalClearancePayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
            'generated' => $document->locational_clearance_generated_at !== null,
            'generatedAt' => $document->locational_clearance_generated_at,
            'data' => $this->builder->build($document),
        ]);
    }

    public function updatePaymentDetails(Request $request, Document $document): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canManageLocationalClearancePayment($user, $document)) {
            return response()->json([
                'message' => 'Only authorized Zoning Officer accounts can enter or modify these payment details.',
            ], 403);
        }

        $validated = $request->validate(LocationalClearancePayment::rules());
        $document->update(LocationalClearancePayment::fromValidated($validated));

        ActivityLogger::log(
            'update',
            'files',
            $document->zoning_application_no,
            "Updated Locational Clearance payment details for document: {$document->document_title} ({$document->zoning_application_no})"
        );

        $document = $this->loadDocument($document->fresh());

        return response()->json([
            'message' => 'Locational Clearance payment details saved.',
            'document' => $document,
            'data' => $this->builder->build($document),
        ]);
    }

    public function generate(Document $document): JsonResponse
    {
        $document = $this->loadDocument($document);
        $alreadyGenerated = $document->locational_clearance_generated_at !== null;

        if (! $alreadyGenerated) {
            $eligibility = $this->builder->eligibility($document);

            if (! $eligibility['eligible']) {
                return response()->json([
                    'message' => 'This document is not ready for Locational Clearance generation.',
                    'reasons' => $eligibility['reasons'],
                ], 422);
            }

            $document->locational_clearance_generated_at = now();
            $document->save();

            ActivityLogger::log(
                'create',
                'files',
                $document->zoning_application_no,
                "Generated Locational Clearance for document: {$document->document_title} ({$document->zoning_application_no})"
            );
        }

        $document = $this->loadDocument($document->fresh());

        return response()->json([
            'message' => $alreadyGenerated
                ? 'Locational Clearance already generated.'
                : 'Locational Clearance generated successfully.',
            'generated' => true,
            'generatedAt' => $document->locational_clearance_generated_at,
            'document' => $document,
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
