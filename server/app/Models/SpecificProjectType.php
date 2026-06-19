<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SpecificProjectType extends Model
{
    protected $fillable = ['project_type_id', 'name'];

    public function projectType()
    {
        return $this->belongsTo(ProjectType::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }
}
