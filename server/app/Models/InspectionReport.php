<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InspectionReport extends Model
{
    protected $fillable = [
        'document_id',
        'inspector_id',
        'status',
        'date_of_report',
        'project_significance',
        'right_over_land',
        'area_details',
        'location_details',
        'landmark',
        'field_verifications',
        'inspection_date',
        'project_status_as_of_inspection',
        'gps_coordinates',
        'abutting_north',
        'abutting_south',
        'abutting_east',
        'abutting_west',
        'findings_evaluation',
        'frontages',
        'road_category',
        'road_standard_rrow',
        'road_actual_rrow',
        'road_min_setback',
        'road_as_per_plan',
        'parking_building_code',
        'parking_space_requirement',
        'parking_as_per_plan',
        'parking_remarks',
        'type_of_lot',
        'lacking_documents',
        'front_setback',
        'distance_center_line_to_building',
        'road_category_info',
        'setback_requirements',
        'parking_space_requirements',
        'decision_recommended',
        'recommendation_findings',
        'remarks',
        'inspector_signature',
        'inspector_designation',
        'noted_by_signature',
        'noted_by_designation',
        'additional_conditions',
        'recommended_for_approval_name',
        'recommended_for_approval_designation',
        'approved_by_name',
        'approved_by_designation',
        'reviewed_at',
        'reviewed_by_user_id',
        'submitted_at',
        'submission_history',
    ];

    protected function casts(): array
    {
        return [
            'date_of_report' => 'date',
            'inspection_date' => 'date',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'submission_history' => 'array',
            'field_verifications' => 'array',
            'frontages' => 'array',
            'parking_space_requirement' => 'array',
            'parking_as_per_plan' => 'array',
            'recommendation_findings' => 'array',
        ];
    }

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function inspector()
    {
        return $this->belongsTo(User::class, 'inspector_id');
    }

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function photos()
    {
        return $this->hasMany(DocumentAttachment::class)
            ->where('attachment_type', 'inspection_photo')
            ->latest();
    }

    public function reviewedReportAttachment()
    {
        return $this->hasOne(DocumentAttachment::class)->ofMany(
            ['id' => 'max'],
            function ($query) {
                $query->where('attachment_type', 'reviewed_inspection_report');
            }
        );
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }
}
