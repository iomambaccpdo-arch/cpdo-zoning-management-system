<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DueDateExtension extends Model
{
    protected $fillable = [
        'document_id',
        'extended_by',
        'days_added',
        'previous_due_date',
        'new_due_date',
        'reason',
    ];

    protected $casts = [
        'previous_due_date' => 'date',
        'new_due_date' => 'date',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function extendedBy()
    {
        return $this->belongsTo(User::class, 'extended_by');
    }
}
