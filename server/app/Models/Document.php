<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $fillable = [
        'document_title',
        'zoning_id',
        'zoning_application_no',
        'project_type_id',
        'specific_project_type_id',
        'date_of_application',
        'due_date',
        'applicant_name',
        'corporation_name',
        'corporation_address',
        'received_by',
        'received_by_user_id',
        'assisted_by',
        'oic',
        'barangay_id',
        'purok_id',
        'landmark',
        'coordinates',
        'buildings',
        'lots',
        'floor_area',
        'lot_area',
        'storey',
        'mezanine',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'buildings' => 'array',
            'lots' => 'array',
        ];
    }

    public function zoning()
    {
        return $this->belongsTo(Zoning::class);
    }

    public function projectType()
    {
        return $this->belongsTo(ProjectType::class);
    }

    public function specificProjectType()
    {
        return $this->belongsTo(SpecificProjectType::class);
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }

    public function purok()
    {
        return $this->belongsTo(Purok::class);
    }

    public function receivedByUser()
    {
        return $this->belongsTo(User::class, 'received_by_user_id');
    }

    public function routedToUsers()
    {
        return $this->belongsToMany(User::class, 'document_routes', 'document_id', 'user_id')->withTimestamps();
    }

    protected function receivedBy(): Attribute
    {
        return Attribute::get(function (?string $value) {
            if ($this->received_by_user_id) {
                $user = $this->relationLoaded('receivedByUser')
                    ? $this->receivedByUser
                    : $this->receivedByUser()->first();

                if ($user) {
                    return $user->fullName();
                }
            }

            return $value;
        });
    }

    public function attachments()
    {
        return $this->hasMany(DocumentAttachment::class);
    }

    public function dueDateExtensions()
    {
        return $this->hasMany(DueDateExtension::class)->latest();
    }

    public function inspectionReport()
    {
        return $this->hasOne(InspectionReport::class);
    }
}
