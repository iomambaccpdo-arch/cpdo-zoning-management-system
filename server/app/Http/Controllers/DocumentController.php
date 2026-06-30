<?php

namespace App\Http\Controllers;

use App\Jobs\SendDocumentRoutedEmail;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DueDateExtension;
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

        $overdueCount = Document::query()
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', Carbon::today())
            ->whereIn('status', ['pending', 'processing'])
            ->count();

        return response()->json([
            'monthly_counts' => $months,
            'recent_attachments' => $recentAttachments,
            'overdue_count' => $overdueCount,
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
            'specificProjectType' => $this->specificProjectTypeRule($request),
            'dueDate' => 'nullable|string',
            'applicantName' => 'required|string',
            'assistedBy' => 'nullable|string',
            'oic' => 'nullable|string',
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
            ...$this->pdfUploadRules(required: true),
        ]);

        try {
            DB::beginTransaction();

            // 1. Create the Document
            $document = Document::create([
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'specific_project_type_id' => $validatedData['specificProjectType'] === 'N/A' ? null : (int) $validatedData['specificProjectType'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
                'due_date' => $validatedData['dueDate'] ? Carbon::parse($validatedData['dueDate'])->format('Y-m-d') : null,
                'applicant_name' => $validatedData['applicantName'],
                ...$this->receivedByFields(),
                'assisted_by' => $validatedData['assistedBy'] ?? null,
                'oic' => $validatedData['oic'] ?? '',
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
            $this->storeUploadedFiles($document, $request->file('files'));

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

        $query = Document::with(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser'])
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
                    ->orWhereHas('specificProjectType', function ($spq) use ($search) {
                        $spq->where('name', 'like', "%{$search}%");
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

    public function overdue(Request $request)
    {
        $perPage = (int) $request->query('per_page', 15);
        $today = Carbon::today();

        $paginator = Document::query()
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->whereIn('status', ['pending', 'processing'])
            ->with(['projectType', 'barangay', 'purok'])
            ->orderBy('due_date')
            ->paginate($perPage);

        $paginator->getCollection()->transform(function (Document $document) use ($today) {
            $document->days_overdue = Carbon::parse($document->due_date)->diffInDays($today);

            return $document;
        });

        return response()->json($paginator);
    }

    public function show(Document $document)
    {
        return response()->json(
            $document->load([
                'zoning',
                'projectType',
                'specificProjectType',
                'barangay',
                'purok',
                'routedToUsers',
                'receivedByUser',
                'attachments.uploader:id,first_name,last_name',
                'dueDateExtensions.extendedBy:id,first_name,last_name',
                'inspectionReport.inspector:id,first_name,middle_name,last_name,designation',
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
            'files' => 'required|array|min:1|max:'.config('uploads.max_files_per_request'),
            'files.*' => 'file|mimes:pdf|max:'.config('uploads.max_file_size_kb'),
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
            'specificProjectType' => $this->specificProjectTypeRule($request),
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
            ...$this->pdfUploadRules(),
        ]);

        try {
            DB::beginTransaction();

            $document->update([
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'specific_project_type_id' => $validatedData['specificProjectType'] === 'N/A' ? null : (int) $validatedData['specificProjectType'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
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
                'document' => $document->load(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser']),
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
        $path = $attachment->absolutePath();

        if ($path === null) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return response()->download($path, $attachment->file_name);
    }

    public function previewAttachment(DocumentAttachment $attachment)
    {
        $path = $attachment->absolutePath();

        if ($path === null) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        return response()->file($path);
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
    /**
     * @return array<string, string>
     */
    private function pdfUploadRules(bool $required = false): array
    {
        $maxKb = config('uploads.max_file_size_kb');
        $maxFiles = config('uploads.max_files_per_request');
        $filesRule = $required
            ? "required|array|min:1|max:{$maxFiles}"
            : "nullable|array|max:{$maxFiles}";

        return [
            'files' => $filesRule,
            'files.*' => "file|mimes:pdf|max:{$maxKb}",
        ];
    }

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

            if (! Storage::disk('local')->exists($path)) {
                throw new \RuntimeException('Failed to save uploaded PDF to storage.');
            }

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

    public function extendDueDate(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'daysToAdd' => 'required|integer|min:1|max:365',
            'reason' => 'required|string|max:500',
        ]);

        if (! $document->due_date) {
            return response()->json(['message' => 'Document does not have a due date to extend.'], 400);
        }

        try {
            DB::beginTransaction();

            $previousDueDate = $document->due_date;
            $newDueDate = Carbon::parse($previousDueDate)->addDays($validatedData['daysToAdd']);

            // Update document due date
            $document->update([
                'due_date' => $newDueDate->format('Y-m-d'),
            ]);

            // Create audit trail record
            $extension = DueDateExtension::create([
                'document_id' => $document->id,
                'extended_by' => Auth::id(),
                'days_added' => $validatedData['daysToAdd'],
                'previous_due_date' => $previousDueDate,
                'new_due_date' => $newDueDate->format('Y-m-d'),
                'reason' => $validatedData['reason'],
            ]);

            DB::commit();

            ActivityLogger::log(
                'update',
                'documents',
                $document->zoning_application_no,
                "Extended due date for document: {$document->document_title} ({$document->zoning_application_no}) by {$validatedData['daysToAdd']} days. Reason: {$validatedData['reason']}"
            );

            return response()->json([
                'message' => 'Due date extended successfully.',
                'document' => $document->fresh()->load(['dueDateExtensions.extendedBy:id,first_name,last_name']),
                'extension' => $extension->load('extendedBy:id,first_name,last_name'),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to extend due date.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateOic(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        try {
            $user = User::findOrFail($validatedData['user_id']);
            $oicName = $user->fullName();

            $document->update([
                'oic' => $oicName,
            ]);

            ActivityLogger::log(
                'update',
                'documents',
                $document->zoning_application_no,
                "Updated OIC for document: {$document->document_title} ({$document->zoning_application_no}) to {$oicName}"
            );

            return response()->json([
                'message' => 'OIC updated successfully.',
                'document' => $document->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update OIC.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'status' => 'required|in:pending,processing,completed,finalized',
        ]);

        try {
            $document->update([
                'status' => $validatedData['status'],
            ]);

            ActivityLogger::log(
                'update',
                'documents',
                $document->zoning_application_no,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to {$validatedData['status']}"
            );

            return response()->json([
                'message' => 'Document status updated successfully.',
                'document' => $document->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update document status.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function uploadOicAttachment(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        if (! in_array($document->status, ['completed', 'finalized'])) {
            return response()->json([
                'message' => 'OIC attachment can only be uploaded for completed or finalized documents.',
            ], 403);
        }

        try {
            $file = $validatedData['file'];
            $fileName = time().'_OIC_'.$file->getClientOriginalName();
            $filePath = $file->storeAs('documents/oic', $fileName, 'public');

            $attachment = DocumentAttachment::create([
                'document_id' => $document->id,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'attachment_type' => 'oic',
            ]);

            ActivityLogger::log(
                'create',
                'document_attachments',
                $document->zoning_application_no,
                "Uploaded OIC attachment for document: {$document->document_title} ({$document->zoning_application_no})"
            );

            return response()->json([
                'message' => 'OIC attachment uploaded successfully.',
                'attachment' => $attachment,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to upload OIC attachment.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function specificProjectTypeRule(Request $request): array
    {
        return [
            'required',
            'string',
            function ($attribute, $value, $fail) use ($request) {
                $projectTypeId = $request->input('typeOfProject');
                if ($projectTypeId) {
                    $hasSpecificTypes = \App\Models\SpecificProjectType::where('project_type_id', $projectTypeId)->exists();
                    if ($hasSpecificTypes) {
                        if ($value === 'N/A' || $value === '') {
                            $fail('The Specific Project Type field is required.');
                        } else {
                            $exists = \App\Models\SpecificProjectType::where('id', $value)
                                ->where('project_type_id', $projectTypeId)
                                ->exists();
                            if (! $exists) {
                                $fail('The selected Specific Project Type is invalid.');
                            }
                        }
                    } else {
                        if ($value !== 'N/A') {
                            $fail('The Specific Project Type must be N/A.');
                        }
                    }
                }
            },
        ];
    }
}
