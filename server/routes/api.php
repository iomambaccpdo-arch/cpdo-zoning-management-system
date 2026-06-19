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
    Route::post('documents', [\App\Http\Controllers\DocumentController::class, 'store']);
    Route::post('documents/{document}', [\App\Http\Controllers\DocumentController::class, 'update']);
    Route::delete('documents/{document}', [\App\Http\Controllers\DocumentController::class, 'destroy']);
    Route::post('documents/{document}/extend-due-date', [\App\Http\Controllers\DocumentController::class, 'extendDueDate'])->middleware('permission:files,extend_due_date');
    Route::put('documents/{document}/status', [\App\Http\Controllers\DocumentController::class, 'updateStatus'])->middleware('permission:files,update');
    Route::post('documents/{document}/oic-attachment', [\App\Http\Controllers\DocumentController::class, 'uploadOicAttachment'])->middleware('permission:files,update');
    Route::put('documents/{document}/oic', [\App\Http\Controllers\DocumentController::class, 'updateOic'])->middleware('permission:files,update');

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
