<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentAttachmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);

    // Accounts Management
    Route::apiResource('users', UserController::class)->middleware('permission:accounts,view');
    Route::post('users/{user}', [UserController::class, 'update'])->middleware('permission:accounts,edit'); // For multipart/form-data if needed, but here we use json

    // Profile Management
    Route::put('/profile', [ProfileController::class, 'update']);

    // Dashboard
    Route::get('dashboard', [\App\Http\Controllers\DocumentController::class, 'dashboard']);

    // Documents
    Route::get('documents/next-application-no', [\App\Http\Controllers\DocumentController::class, 'getNextApplicationNo']);
    Route::get('documents/overdue', [\App\Http\Controllers\DocumentController::class, 'overdue']);
    Route::get('documents', [\App\Http\Controllers\DocumentController::class, 'index']);
    Route::get('documents/{document}', [\App\Http\Controllers\DocumentController::class, 'show']);
    Route::get('documents/{document}/attachments', [\App\Http\Controllers\DocumentController::class, 'attachments']);
    Route::post('documents/{document}/attachments', [\App\Http\Controllers\DocumentController::class, 'uploadAttachments']);
    Route::post('documents', [\App\Http\Controllers\DocumentController::class, 'store'])->middleware('permission:files,create');
    Route::post('documents/{document}', [\App\Http\Controllers\DocumentController::class, 'update'])->middleware('permission:files,update');
    Route::post('documents/{document}/submit', [\App\Http\Controllers\DocumentController::class, 'submitApplication'])->middleware('permission:files,submit_application');
    Route::delete('documents/{document}', [\App\Http\Controllers\DocumentController::class, 'destroy'])->middleware('permission:files,delete');
    Route::post('documents/{document}/extend-due-date', [\App\Http\Controllers\DocumentController::class, 'extendDueDate'])->middleware('permission:files,extend_due_date');
    Route::post('documents/{document}/return-to-encoder', [\App\Http\Controllers\DocumentController::class, 'returnToEncoder'])->middleware('permission:files,update');
    Route::post('documents/{document}/approve', [\App\Http\Controllers\DocumentController::class, 'approveApplication'])->middleware('permission:files,approve_application');
    Route::post('documents/{document}/oic-attachment', [\App\Http\Controllers\DocumentController::class, 'uploadOicAttachment'])->middleware('permission:files,update');
    Route::put('documents/{document}/oic', [\App\Http\Controllers\DocumentController::class, 'updateOic'])->middleware('permission:files,update');

    // Inspection Reports
    Route::get('documents/{document}/inspection-report/photos', [\App\Http\Controllers\InspectionReportController::class, 'photos']);
    Route::post('documents/{document}/inspection-report/photos', [\App\Http\Controllers\InspectionReportController::class, 'uploadPhotos'])->middleware('permission:files,inspection_report');
    Route::delete('documents/{document}/inspection-report/photos/{attachment}', [\App\Http\Controllers\InspectionReportController::class, 'destroyPhoto'])->middleware('permission:files,inspection_report');
    Route::get('documents/{document}/inspection-report', [\App\Http\Controllers\InspectionReportController::class, 'show']);
    Route::post('documents/{document}/inspection-report', [\App\Http\Controllers\InspectionReportController::class, 'store'])->middleware('permission:files,inspection_report');
    Route::put('documents/{document}/inspection-report/{inspectionReport}', [\App\Http\Controllers\InspectionReportController::class, 'update'])->middleware('permission:files,inspection_report');
    Route::post('documents/{document}/inspection-report/{inspectionReport}/return-for-revision', [\App\Http\Controllers\InspectionReportController::class, 'returnForRevision'])->middleware('permission:files,inspection_report');
    Route::post('documents/{document}/inspection-report/{inspectionReport}/review', [\App\Http\Controllers\InspectionReportController::class, 'review'])->middleware('permission:files,review_inspection_report');

    // Locational Clearance
    Route::get('documents/{document}/locational-clearance', [\App\Http\Controllers\LocationalClearanceController::class, 'show'])->middleware('permission:files,generate_locational_clearance');
    Route::put('documents/{document}/locational-clearance/payment', [\App\Http\Controllers\LocationalClearanceController::class, 'updatePaymentDetails'])->middleware('permission:files,generate_locational_clearance');
    Route::post('documents/{document}/locational-clearance/generate', [\App\Http\Controllers\LocationalClearanceController::class, 'generate'])->middleware('permission:files,generate_locational_clearance');

    // File Attachments
    Route::get('attachments', [DocumentAttachmentController::class, 'index']);
    Route::get('attachments/{attachment}/preview', [DocumentAttachmentController::class, 'preview']);
    Route::get('attachments/{attachment}/download', [DocumentAttachmentController::class, 'download']);
    Route::delete('attachments/{attachment}', [DocumentAttachmentController::class, 'destroy']);

    Route::get('roles', [RoleController::class, 'index'])->middleware('permission:accounts,view');
    Route::get('zonings', [\App\Http\Controllers\ZoningController::class, 'index']);
    Route::get('barangays', [\App\Http\Controllers\BarangayController::class, 'index']);
    Route::get('settings', [\App\Http\Controllers\SettingController::class, 'index']);

    // Activity Logs
    Route::get('activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:Activity Logs,view');
});
