<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentAttachment extends Model
{
    protected $fillable = [
        'document_id',
        'inspection_report_id',
        'uploaded_by',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'attachment_type',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function inspectionReport()
    {
        return $this->belongsTo(InspectionReport::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isInspectionPhoto(): bool
    {
        return $this->attachment_type === 'inspection_photo';
    }

    public function isReviewedInspectionReport(): bool
    {
        return $this->attachment_type === 'reviewed_inspection_report';
    }
}
