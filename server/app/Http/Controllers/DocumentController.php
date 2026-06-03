<?php

namespace App\Http\Controllers;

use App\Jobs\SendDocumentRoutedEmail;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\User;
use App\Support\ActivityLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    // ---------------------------------------------------------------
    // Dashboard: monthly document counts + recent file attachments
    // ---------------------------------------------------------------
    public function dashboard(Request $request)
    {
        $year = (int) $request->query('year', Carbon::now()->year);

        // Count documents per month for the given year (PostgreSQL-compatible)
        $rows = Document::selectRaw('EXTRACT(MONTH FROM created_at)::integer as month, COUNT(*) as count')
            ->whereYear('created_at', $year)
            ->groupByRaw('EXTRACT(MONTH FROM created_at)')
            ->get()
            ->keyBy('month');

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[] = [
                'month' => $m,
                'month_name' => Carbon::create($year, $m, 1)->format('F'),
                'count' => isset($rows[$m]) ? (int) $rows[$m]->count : 0,
            ];
        }

        // 10 most-recent attachments across all documents
        $recentAttachments = DocumentAttachment::with('document:id,document_title')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'document_id', 'file_name', 'file_type', 'file_size', 'created_at']);

        return response()->json([
            'monthly_counts' => $months,
            'recent_attachments' => $recentAttachments,
        ]);
    }

    public function getNextApplicationNo(Request $request)
    {
        $prefix = 'LC';

        $currentYear = Carbon::now()->year;

        $searchPrefix = "{$prefix}-{$currentYear}-";

        $latestDocument = Document::where('zoning_application_no', 'like', $searchPrefix.'%')
            ->orderBy('zoning_application_no', 'desc')
            ->first();

        if (! $latestDocument) {
            return response()->json(['applicationNo' => current([$searchPrefix.'0001'])]);
        }

        $lastNumber = intval(substr($latestDocument->zoning_application_no, -4));
        $nextNumber = str_pad($lastNumber + 1, 4, '0', STR_PAD_LEFT);

        return response()->json(['applicationNo' => $searchPrefix.$nextNumber]);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'documentTitle' => 'required|string',
            'zoning' => 'required|exists:zonings,id',
            'zoningApplicationNo' => 'required|string',
            'typeOfProject' => 'required|exists:project_types,id',
            'dueDate' => 'nullable|string',
            'applicantName' => 'required|string',
            'assistedBy' => 'nullable|string',
            'oic' => 'required|string',
            'barangay' => 'required|exists:barangays,id',
            'purok' => 'required|exists:puroks,id',
            'landmark' => 'required|string',
            'coordinates' => 'nullable|string',
            'floorArea' => 'required|string',
            'lotArea' => 'required|string',
            'storey' => 'required|string',
            'mezanine' => 'nullable|string',
            'routedTo' => 'required|array',
            'routedTo.*' => 'exists:users,id',
            'files' => 'nullable|array',
            'files.*' => 'file|mimes:pdf',
        ]);

        try {
            DB::beginTransaction();

            // 1. Create the Document
            $document = Document::create([
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
                'due_date' => $validatedData['dueDate'] ? Carbon::parse($validatedData['dueDate'])->format('Y-m-d') : null,
                'applicant_name' => $validatedData['applicantName'],
                ...$this->receivedByFields(),
                'assisted_by' => $validatedData['assistedBy'] ?? null,
                'oic' => $validatedData['oic'],
                'barangay_id' => $validatedData['barangay'],
                'purok_id' => $validatedData['purok'],
                'landmark' => $validatedData['landmark'],
                'coordinates' => $validatedData['coordinates'] ?? null,
                'floor_area' => $validatedData['floorArea'],
                'lot_area' => $validatedData['lotArea'],
                'storey' => $validatedData['storey'],
                'mezanine' => $validatedData['mezanine'] ?? null,
            ]);

            // 2. Attach routes (Users)
            if (! empty($validatedData['routedTo'])) {
                $document->routedToUsers()->attach($validatedData['routedTo']);
            }

            // 3. Process File Uploads
            if ($request->hasFile('files')) {
                $this->storeUploadedFiles($document, $request->file('files'));
            }

            DB::commit();

            ActivityLogger::log(
                'create',
                'documents',
                $document->zoning_application_no,
                "Created document: {$document->document_title} ({$document->zoning_application_no})"
            );

            // 4. Dispatch Email Jobs
            if (! empty($validatedData['routedTo'])) {
                $routedUsers = User::whereIn('id', $validatedData['routedTo'])->get();
                foreach ($routedUsers as $user) {
                    SendDocumentRoutedEmail::dispatch($document, $user);
                }
            }

            return response()->json([
                'message' => 'Document created successfully.',
                'document' => $document->load(['attachments', 'routedToUsers', 'receivedByUser']),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to create document.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 15);
        $search = $request->query('search', '');
        $year = $request->query('year');
        $month = $request->query('month');

        $query = Document::with(['zoning', 'projectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser'])
            ->latest();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('document_title', 'like', "%{$search}%")
                    ->orWhere('applicant_name', 'like', "%{$search}%")
                    ->orWhere('zoning_application_no', 'like', "%{$search}%")
                    ->orWhere('received_by', 'like', "%{$search}%")
                    ->orWhere('assisted_by', 'like', "%{$search}%")
                    ->orWhere('oic', 'like', "%{$search}%")
                    ->orWhere('landmark', 'like', "%{$search}%")
                    ->orWhereHas('projectType', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('barangay', function ($bq) use ($search) {
                        $bq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('purok', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('receivedByUser', function ($uq) use ($search) {
                        $uq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('middle_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('designation', 'like', "%{$search}%");
                    });
            });
        }

        if ($year) {
            $query->whereYear('created_at', (int) $year);
        }
        if ($month) {
            $query->whereMonth('created_at', (int) $month);
        }

        return response()->json($query->paginate($perPage));
    }

    public function show(Document $document)
    {
        return response()->json(
            $document->load([
                'zoning',
                'projectType',
                'barangay',
                'purok',
                'routedToUsers',
                'receivedByUser',
                'attachments.uploader:id,first_name,last_name',
            ])
        );
    }

    public function attachments(Document $document)
    {
        return response()->json(
            $document->attachments()
                ->with('uploader:id,first_name,last_name')
                ->latest()
                ->get()
        );
    }

    public function uploadAttachments(Request $request, Document $document)
    {
        $request->validate([
            'files' => 'required|array|min:1',
            'files.*' => 'file|mimes:pdf',
        ]);

        try {
            DB::beginTransaction();

            $attachments = $this->storeUploadedFiles($document, $request->file('files'));

            DB::commit();

            ActivityLogger::log(
                'update',
                'files',
                $document->zoning_application_no,
                'Uploaded additional attachments for document: '.$document->document_title
            );

            return response()->json([
                'message' => 'Attachments uploaded successfully.',
                'attachments' => $attachments,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to upload attachments.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'documentTitle' => 'required|string',
            'zoning' => 'required|exists:zonings,id',
            'zoningApplicationNo' => 'required|string',
            'typeOfProject' => 'required|exists:project_types,id',
            'dueDate' => 'nullable|string',
            'applicantName' => 'required|string',
            'assistedBy' => 'nullable|string',
            'oic' => 'required|string',
            'barangay' => 'required|exists:barangays,id',
            'purok' => 'required|exists:puroks,id',
            'landmark' => 'required|string',
            'coordinates' => 'nullable|string',
            'floorArea' => 'required|string',
            'lotArea' => 'required|string',
            'storey' => 'required|string',
            'mezanine' => 'nullable|string',
            'routedTo' => 'required|array',
            'routedTo.*' => 'exists:users,id',
            'files' => 'nullable|array',
            'files.*' => 'file|mimes:pdf',
        ]);

        try {
            DB::beginTransaction();

            $document->update([
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
                'due_date' => isset($validatedData['dueDate']) ? Carbon::parse($validatedData['dueDate'])->format('Y-m-d') : null,
                'applicant_name' => $validatedData['applicantName'],
                ...$this->receivedByFields(),
                'assisted_by' => $validatedData['assistedBy'] ?? null,
                'oic' => $validatedData['oic'],
                'barangay_id' => $validatedData['barangay'],
                'purok_id' => $validatedData['purok'],
                'landmark' => $validatedData['landmark'],
                'coordinates' => $validatedData['coordinates'] ?? null,
                'floor_area' => $validatedData['floorArea'],
                'lot_area' => $validatedData['lotArea'],
                'storey' => $validatedData['storey'],
                'mezanine' => $validatedData['mezanine'] ?? null,
            ]);

            // Sync routedTo users
            $document->routedToUsers()->sync($validatedData['routedTo']);

            // Append new file uploads (keep existing attachments)
            if ($request->hasFile('files')) {
                $this->storeUploadedFiles($document, $request->file('files'));
            }

            DB::commit();

            ActivityLogger::log(
                'update',
                'documents',
                $document->zoning_application_no,
                "Updated document: {$document->document_title} ({$document->zoning_application_no})"
            );

            return response()->json([
                'message' => 'Document updated successfully.',
                'document' => $document->load(['zoning', 'projectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Failed to update document.', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy(Document $document)
    {
        try {
            $title = $document->document_title;
            $appNo = $document->zoning_application_no;

            // Delete stored files from disk
            foreach ($document->attachments as $attachment) {
                Storage::disk('local')->delete($attachment->file_path);
            }
            $document->delete();

            ActivityLogger::log(
                'delete',
                'documents',
                $appNo,
                "Deleted document: {$title} ({$appNo})"
            );

            return response()->json(['message' => 'Document deleted successfully.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete document.', 'error' => $e->getMessage()], 500);
        }
    }

    public function downloadAttachment(DocumentAttachment $attachment)
    {
        if (! Storage::disk('local')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return Storage::disk('local')->download($attachment->file_path, $attachment->file_name);
    }

    public function previewAttachment(DocumentAttachment $attachment)
    {
        if (! Storage::disk('local')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return Storage::disk('local')->response($attachment->file_path);
    }

    public function deleteAttachment(DocumentAttachment $attachment)
    {
        try {
            Storage::disk('local')->delete($attachment->file_path);
            $attachment->delete();

            return response()->json(['message' => 'Attachment deleted successfully.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete attachment.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * @return array{received_by: string, received_by_user_id: int}
     */
    private function receivedByFields(): array
    {
        /** @var User $user */
        $user = Auth::user();

        return [
            'received_by' => $user->fullName(),
            'received_by_user_id' => $user->id,
        ];
    }

    private function storeUploadedFiles(Document $document, array $files): array
    {
        $attachments = [];
        $yearMonth = Carbon::now()->format('Y/m');

        foreach ($files as $file) {
            $path = $file->store("documents/{$yearMonth}/{$document->id}", 'local');
            $attachment = $document->attachments()->create([
                'uploaded_by' => Auth::id(),
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            $attachments[] = $attachment->load('uploader:id,first_name,last_name');
        }

        return $attachments;
    }
}
