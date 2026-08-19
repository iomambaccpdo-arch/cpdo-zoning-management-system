<?php

namespace App\Http\Controllers;

use App\Jobs\SendDocumentRoutedEmail;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DueDateExtension;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\DocumentAuthorization;
use App\Support\DocumentPropertyDetails;
use App\Support\DocumentStatus;
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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        $year = (int) $request->query('year', Carbon::now()->year);

        $documentQuery = DocumentAuthorization::scopeForUser(Document::query(), $user);

        $rows = (clone $documentQuery)
            ->selectRaw('EXTRACT(MONTH FROM created_at)::integer as month, COUNT(*) as count')
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

        $recentAttachmentsQuery = DocumentAttachment::with('document:id,document_title')
            ->orderByDesc('created_at')
            ->limit(10);

        if (DocumentAuthorization::isEncoder($user)) {
            $documentIds = (clone $documentQuery)->pluck('id');
            $recentAttachmentsQuery->whereIn('document_id', $documentIds);
        }

        $recentAttachments = $recentAttachmentsQuery->get(['id', 'document_id', 'file_name', 'file_type', 'file_size', 'created_at']);

        $overdueCount = DocumentAuthorization::isEncoder($user)
            ? 0
            : Document::query()
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', Carbon::today())
                ->whereIn('status', DocumentStatus::overdueEligible())
                ->count();

        $encodingCount = DocumentAuthorization::isEncoder($user)
            ? (clone $documentQuery)->where('status', DocumentStatus::ENCODING)->count()
            : 0;

        $returnedCount = DocumentAuthorization::isEncoder($user)
            ? (clone $documentQuery)->where('status', DocumentStatus::RETURNED)->count()
            : 0;

        return response()->json([
            'monthly_counts' => $months,
            'recent_attachments' => $recentAttachments,
            'overdue_count' => $overdueCount,
            'encoding_count' => $encodingCount,
            'returned_count' => $returnedCount,
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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        $isEncoder = DocumentAuthorization::isEncoder($user);
        $saveAsDraft = $request->boolean('saveAsDraft');
        $submitForProcessing = $request->boolean('submitForProcessing');

        if ($isEncoder && $submitForProcessing) {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: true, requireRoutedTo: true));
            $status = DocumentStatus::ENCODED;
        } elseif ($isEncoder && $saveAsDraft) {
            $validatedData = $request->validate($this->draftDocumentRules($request));
            $status = DocumentStatus::ENCODING;
        } elseif ($isEncoder) {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: true, requireRoutedTo: true));
            $status = DocumentStatus::ENCODING;
        } else {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: true, requireRoutedTo: true));
            $status = DocumentStatus::ENCODED;
        }

        try {
            DB::beginTransaction();

            $propertyDetails = DocumentPropertyDetails::fromRequestPayload(
                $validatedData['buildings'] ?? null,
                $validatedData['lots'] ?? null,
                $validatedData['floorArea'] ?? '',
                $validatedData['lotArea'] ?? '',
            );

            $document = Document::create([
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'specific_project_type_id' => $validatedData['specificProjectType'] === 'N/A' ? null : (int) $validatedData['specificProjectType'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
                'due_date' => ! empty($validatedData['dueDate']) ? Carbon::parse($validatedData['dueDate'])->format('Y-m-d') : null,
                'applicant_name' => $validatedData['applicantName'],
                'corporation_name' => $validatedData['corporationName'] ?? null,
                'corporation_address' => $validatedData['corporationAddress'] ?? null,
                ...$this->receivedByFields(),
                'assisted_by' => $validatedData['assistedBy'] ?? null,
                'oic' => $isEncoder ? '' : ($validatedData['oic'] ?? ''),
                'barangay_id' => $validatedData['barangay'],
                'purok_id' => $validatedData['purok'],
                'landmark' => $validatedData['landmark'],
                'coordinates' => $validatedData['coordinates'] ?? null,
                'buildings' => $propertyDetails['buildings'],
                'lots' => $propertyDetails['lots'],
                'floor_area' => $propertyDetails['floor_area'],
                'lot_area' => $propertyDetails['lot_area'],
                'storey' => $validatedData['storey'] ?? '',
                'mezanine' => $validatedData['mezanine'] ?? null,
                'status' => $status,
            ]);

            if (! empty($validatedData['routedTo'])) {
                $document->routedToUsers()->attach($validatedData['routedTo']);
            }

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

            if ($status === DocumentStatus::ENCODED) {
                ActivityLogger::log(
                    'update',
                    'documents',
                    $document->zoning_application_no,
                    "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to encoded"
                );
            }

            if ($status === DocumentStatus::ENCODED && ! empty($validatedData['routedTo'])) {
                $routedUsers = User::whereIn('id', $validatedData['routedTo'])->get();
                foreach ($routedUsers as $routedUser) {
                    SendDocumentRoutedEmail::dispatch($document, $routedUser);
                }
            }

            return response()->json([
                'message' => $status === DocumentStatus::ENCODING
                    ? 'Application draft saved successfully.'
                    : ($status === DocumentStatus::ENCODED
                        ? 'Application submitted successfully.'
                        : 'Document created successfully.'),
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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        $perPage = $request->query('per_page', 15);
        $search = $request->query('search', '');
        $year = $request->query('year');
        $month = $request->query('month');
        $status = $request->query('status');

        $query = DocumentAuthorization::scopeForUser(
            Document::with(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser']),
            $user
        )->latest();

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

        if ($status) {
            $query->where('status', $status);
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
            ->whereIn('status', DocumentStatus::overdueEligible())
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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! $this->userCanAccessDocument($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to view this application.',
            ], 403);
        }

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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! $this->userCanAccessDocument($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to view attachments for this application.',
            ], 403);
        }

        return response()->json(
            $document->attachments()
                ->where('attachment_type', '!=', 'inspection_photo')
                ->with('uploader:id,first_name,last_name')
                ->latest()
                ->get()
        );
    }

    public function uploadAttachments(Request $request, Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canManageDocument($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to upload attachments for this application.',
            ], 403);
        }

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
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canManageDocument($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to edit this application.',
            ], 403);
        }

        $isEncoder = DocumentAuthorization::isEncoder($user);
        $saveAsDraft = $request->boolean('saveAsDraft');
        $submitForProcessing = $request->boolean('submitForProcessing');

        if ($isEncoder && $submitForProcessing) {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: false, requireRoutedTo: true));
        } elseif ($isEncoder && $saveAsDraft) {
            $validatedData = $request->validate($this->draftDocumentRules($request));
        } elseif ($isEncoder) {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: false, requireRoutedTo: false));
        } else {
            $validatedData = $request->validate($this->fullDocumentRules($request, requireFiles: false, requireRoutedTo: true, requireOic: true));
        }

        try {
            DB::beginTransaction();

            $propertyDetails = DocumentPropertyDetails::fromRequestPayload(
                array_key_exists('buildings', $validatedData)
                    ? ($validatedData['buildings'] ?? [])
                    : $document->buildings,
                array_key_exists('lots', $validatedData)
                    ? ($validatedData['lots'] ?? [])
                    : $document->lots,
                $validatedData['floorArea'] ?? $document->floor_area,
                $validatedData['lotArea'] ?? $document->lot_area,
            );

            $updateData = [
                'document_title' => $validatedData['documentTitle'],
                'zoning_id' => $validatedData['zoning'],
                'zoning_application_no' => $validatedData['zoningApplicationNo'],
                'project_type_id' => $validatedData['typeOfProject'],
                'specific_project_type_id' => $validatedData['specificProjectType'] === 'N/A' ? null : (int) $validatedData['specificProjectType'],
                'date_of_application' => Carbon::now()->format('Y-m-d'),
                'applicant_name' => $validatedData['applicantName'],
                'corporation_name' => $validatedData['corporationName'] ?? null,
                'corporation_address' => $validatedData['corporationAddress'] ?? null,
                ...$this->receivedByFields(),
                'assisted_by' => $validatedData['assistedBy'] ?? null,
                'barangay_id' => $validatedData['barangay'],
                'purok_id' => $validatedData['purok'],
                'landmark' => $validatedData['landmark'],
                'coordinates' => $validatedData['coordinates'] ?? null,
                'buildings' => $propertyDetails['buildings'],
                'lots' => $propertyDetails['lots'],
                'floor_area' => $propertyDetails['floor_area'],
                'lot_area' => $propertyDetails['lot_area'],
                'storey' => $validatedData['storey'] ?? $document->storey,
                'mezanine' => $validatedData['mezanine'] ?? null,
            ];

            if (! $isEncoder) {
                $updateData['oic'] = $validatedData['oic'];
            }

            if ($isEncoder && $submitForProcessing) {
                $updateData['status'] = DocumentStatus::ENCODED;
            } elseif ($isEncoder) {
                $updateData['status'] = DocumentStatus::ENCODING;
            }

            $previousStatus = $document->status;
            $document->update($updateData);

            if (array_key_exists('routedTo', $validatedData)) {
                $document->routedToUsers()->sync($validatedData['routedTo']);
            }

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

            if ($isEncoder && $submitForProcessing && $previousStatus !== DocumentStatus::ENCODED) {
                ActivityLogger::log(
                    'update',
                    'documents',
                    $document->zoning_application_no,
                    "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to encoded"
                );
            }

            if ($isEncoder && $submitForProcessing && ! empty($validatedData['routedTo'])) {
                $routedUsers = User::whereIn('id', $validatedData['routedTo'])->get();
                foreach ($routedUsers as $routedUser) {
                    SendDocumentRoutedEmail::dispatch($document->fresh(), $routedUser);
                }
            }

            return response()->json([
                'message' => $isEncoder && $submitForProcessing
                    ? 'Application submitted successfully.'
                    : ($isEncoder ? 'Application draft saved successfully.' : 'Document updated successfully.'),
                'document' => $document->load(['zoning', 'projectType', 'specificProjectType', 'barangay', 'purok', 'routedToUsers', 'attachments', 'receivedByUser']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Failed to update document.', 'error' => $e->getMessage()], 500);
        }
    }

    public function submitApplication(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canSubmitDocument($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to submit this application.',
            ], 403);
        }

        if ($document->attachments()->count() === 0) {
            return response()->json([
                'message' => 'At least one attachment is required before submission.',
            ], 422);
        }

        if ($document->routedToUsers()->count() === 0) {
            return response()->json([
                'message' => 'Please assign at least one routing recipient before submission.',
            ], 422);
        }

        try {
            DocumentStatus::transition(
                $document,
                DocumentStatus::ENCODED,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to encoded"
            );

            ActivityLogger::log(
                'update',
                'documents',
                $document->zoning_application_no,
                "Submitted application: {$document->document_title} ({$document->zoning_application_no})"
            );

            $routedUsers = $document->routedToUsers()->get();
            foreach ($routedUsers as $routedUser) {
                SendDocumentRoutedEmail::dispatch($document->fresh(), $routedUser);
            }

            return response()->json([
                'message' => 'Application submitted successfully.',
                'document' => $document->fresh()->load(['attachments', 'routedToUsers', 'receivedByUser']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to submit application.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (DocumentAuthorization::isEncoder($user)) {
            return response()->json([
                'message' => 'You are not allowed to delete applications.',
            ], 403);
        }

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

    public function returnToEncoder(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canReturnToEncoder($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to return this application to the encoder.',
            ], 403);
        }

        try {
            DocumentStatus::transition(
                $document,
                DocumentStatus::RETURNED,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to returned"
            );

            return response()->json([
                'message' => 'Application returned to encoder.',
                'document' => $document->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to return application to encoder.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function approveApplication(Document $document)
    {
        /** @var User $user */
        $user = Auth::user();
        $user->loadMissing('roles');

        if (! DocumentAuthorization::canApproveApplication($user, $document)) {
            return response()->json([
                'message' => 'You are not allowed to approve this application.',
            ], 403);
        }

        try {
            DocumentStatus::transition(
                $document,
                DocumentStatus::APPROVED,
                "Updated document status for: {$document->document_title} ({$document->zoning_application_no}) to approved"
            );

            return response()->json([
                'message' => 'Application approved successfully.',
                'document' => $document->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to approve application.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function uploadOicAttachment(Request $request, Document $document)
    {
        $validatedData = $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        if ($document->status !== DocumentStatus::APPROVED) {
            return response()->json([
                'message' => 'OIC attachment can only be uploaded for approved documents.',
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

    private function fullDocumentRules(Request $request, bool $requireFiles = false, bool $requireRoutedTo = true, bool $requireOic = false): array
    {
        $rules = [
            'documentTitle' => 'required|string',
            'zoning' => 'required|exists:zonings,id',
            'zoningApplicationNo' => 'required|string',
            'typeOfProject' => 'required|exists:project_types,id',
            'specificProjectType' => $this->specificProjectTypeRule($request),
            'dueDate' => 'nullable|string',
            'applicantName' => 'required|string',
            'corporationName' => 'nullable|string',
            'corporationAddress' => 'nullable|string',
            'assistedBy' => 'nullable|string',
            'oic' => $requireOic ? 'required|string' : 'nullable|string',
            'barangay' => 'required|exists:barangays,id',
            'purok' => 'required|exists:puroks,id',
            'landmark' => 'required|string',
            'coordinates' => 'nullable|string',
            'buildings' => 'required|array|min:1',
            'buildings.*.name' => 'required|string|max:255',
            'buildings.*.area' => 'required|string|max:255',
            'lots' => 'required|array|min:1',
            'lots.*.land_title' => 'required|string|max:255',
            'lots.*.area' => 'required|string|max:255',
            'floorArea' => 'nullable|string',
            'lotArea' => 'nullable|string',
            'storey' => 'required|string',
            'mezanine' => 'nullable|string',
            'routedTo' => $requireRoutedTo ? 'required|array|min:1' : 'nullable|array',
            'routedTo.*' => 'exists:users,id',
            ...$this->pdfUploadRules(required: $requireFiles),
        ];

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    private function draftDocumentRules(Request $request): array
    {
        return [
            'documentTitle' => 'required|string',
            'zoning' => 'required|exists:zonings,id',
            'zoningApplicationNo' => 'required|string',
            'typeOfProject' => 'required|exists:project_types,id',
            'specificProjectType' => $this->specificProjectTypeRule($request),
            'dueDate' => 'nullable|string',
            'applicantName' => 'required|string',
            'corporationName' => 'nullable|string',
            'corporationAddress' => 'nullable|string',
            'assistedBy' => 'nullable|string',
            'barangay' => 'required|exists:barangays,id',
            'purok' => 'required|exists:puroks,id',
            'landmark' => 'required|string',
            'coordinates' => 'nullable|string',
            'buildings' => 'nullable|array',
            'buildings.*.name' => 'nullable|string|max:255',
            'buildings.*.area' => 'nullable|string|max:255',
            'lots' => 'nullable|array',
            'lots.*.land_title' => 'nullable|string|max:255',
            'lots.*.area' => 'nullable|string|max:255',
            'floorArea' => 'nullable|string',
            'lotArea' => 'nullable|string',
            'storey' => 'nullable|string',
            'mezanine' => 'nullable|string',
            'routedTo' => 'nullable|array',
            'routedTo.*' => 'exists:users,id',
            ...$this->pdfUploadRules(required: false),
        ];
    }

    private function userCanAccessDocument(User $user, Document $document): bool
    {
        return DocumentAuthorization::scopeForUser(Document::query(), $user)
            ->whereKey($document->id)
            ->exists();
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
