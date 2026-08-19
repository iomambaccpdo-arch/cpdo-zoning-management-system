<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $sectionHeadRole = Role::where('code', 750)->first();

        if (! $sectionHeadRole) {
            return;
        }

        $sectionHeadRole->permissions()->detach();
        $sectionHeadRole->users()->detach();
        $sectionHeadRole->delete();
    }

    public function down(): void
    {
        Role::firstOrCreate(['code' => 750], ['name' => 'Section Head']);
    }
};
