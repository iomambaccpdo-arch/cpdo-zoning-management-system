<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectType extends Model
{
    protected $fillable = ['zoning_id', 'name'];

    public function zoning()
    {
        return $this->belongsTo(Zoning::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    public function specificProjectTypes()
    {
        return $this->hasMany(SpecificProjectType::class);
    }
}
