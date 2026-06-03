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
        'date_of_application',
        'due_date',
        'applicant_name',
        'received_by',
        'received_by_user_id',
        'assisted_by',
        'oic',
        'barangay_id',
        'purok_id',
        'landmark',
        'coordinates',
        'floor_area',
        'lot_area',
        'storey',
        'mezanine',
    ];

    public function zoning()
    {
        return $this->belongsTo(Zoning::class);
    }

    public function projectType()
    {
        return $this->belongsTo(ProjectType::class);
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
}
