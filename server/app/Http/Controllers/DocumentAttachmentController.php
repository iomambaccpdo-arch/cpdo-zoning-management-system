<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\DocumentAuthorization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class DocumentAttachmentController extends Controller
{
    /**
     * GET /api/attachments
     * Returns all file attachments (paginated), with their parent document.
     */
    public function index(Request $request)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        $perPage = $request->query('per_page', 16);
        $search = $request->query('search', '');

        $query = DocumentAttachment::with([
            'uploader:id,first_name,last_name',
            'document:id,document_title,zoning_application_no,applicant_name,date_of_application,due_date,project_type_id,specific_project_type_id,barangay_id,purok_id,landmark',
            'document.projectType:id,name',
            'document.specificProjectType:id,name',
            'document.barangay:id,name',
            'document.purok:id,name',
            'document.routedToUsers:id,first_name,last_name',
        ])
            ->whereNotIn('attachment_type', ['inspection_photo', 'reviewed_inspection_report'])
            ->latest();

        if (DocumentAuthorization::isEncoder($user)) {
            $documentIds = DocumentAuthorization::scopeForUser(Document::query(), $user)->pluck('id');
            $query->whereIn('document_id', $documentIds);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('file_name', 'like', "%{$search}%")
                    ->orWhereHas('document', function ($dq) use ($search) {
                        $dq->where('document_title', 'like', "%{$search}%")
                            ->orWhere('applicant_name', 'like', "%{$search}%")
                            ->orWhere('zoning_application_no', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * GET /api/attachments/{attachment}/preview
     * Streams the file inline so the browser can render it (e.g. PDF in iframe).
     */
    public function preview(DocumentAttachment $attachment)
    {
        if (! Storage::disk('local')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $path = Storage::disk('local')->path($attachment->file_path);
        $mimeType = $attachment->file_type ?? mime_content_type($path) ?? 'application/octet-stream';

        return response()->file($path, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.$attachment->file_name.'"',
        ]);
    }

    /**
     * GET /api/attachments/{attachment}/download
     * Streams the file to the browser as a download.
     */
    public function download(DocumentAttachment $attachment)
    {
        if (! Storage::disk('local')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        ActivityLogger::log(
            'download',
            'files',
            $attachment->file_name,
            "Downloaded file: {$attachment->file_name}"
        );

        return Storage::disk('local')->download(
            $attachment->file_path,
            $attachment->file_name,
            ['Content-Type' => $attachment->file_type ?? 'application/octet-stream']
        );
    }

    /**
     * DELETE /api/attachments/{attachment}
     * Deletes the attachment record and its file from disk.
     */
    public function destroy(DocumentAttachment $attachment)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (DocumentAuthorization::isEncoder($user)) {
            return response()->json([
                'message' => 'You are not allowed to delete attachments.',
            ], 403);
        }

        if ($attachment->isInspectionPhoto()) {
            return response()->json([
                'message' => 'Inspection photos must be managed from the inspection report.',
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
                "Deleted file: {$fileName}"
            );

            return response()->json(['message' => 'Attachment deleted successfully.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete attachment.', 'error' => $e->getMessage()], 500);
        }
    }
}
