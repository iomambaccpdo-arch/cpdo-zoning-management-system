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
        'project_life_span',
        'project_significance',
        'right_over_land',
        'area_details',
        'location_details',
        'inspection_date',
        'project_status_as_of_inspection',
        'gps_coordinates',
        'information_provided_in_order',
        'information_provided_findings',
        'abutting_north',
        'abutting_south',
        'abutting_east',
        'abutting_west',
        'legal_bases',
        'findings_evaluation',
        'road_category',
        'road_standard_rrow',
        'road_actual_rrow',
        'road_min_setback',
        'road_as_per_plan',
        'road_remarks',
        'parking_building_code',
        'parking_space_requirement',
        'parking_remarks',
        'type_of_lot',
        'front_setback',
        'distance_center_line_to_building',
        'road_category_info',
        'setback_requirements',
        'parking_space_requirements',
        'decision_recommended',
        'remarks',
        'inspector_signature',
        'inspector_designation',
        'noted_by_signature',
        'noted_by_designation',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'date_of_report' => 'date',
            'inspection_date' => 'date',
            'submitted_at' => 'datetime',
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

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }
}
