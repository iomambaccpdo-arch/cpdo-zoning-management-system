<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $createPermission = Permission::firstOrCreate([
            'resource' => 'Files',
            'name' => 'inspection_report',
        ]);

        Role::whereIn('code', [600, 800, 900])->each(function (Role $role) use ($createPermission) {
            $role->permissions()->syncWithoutDetaching([$createPermission->id]);
        });
    }

    public function down(): void
    {
        $permission = Permission::where('resource', 'Files')
            ->where('name', 'inspection_report')
            ->first();

        if (! $permission) {
            return;
        }

        Role::whereIn('code', [600, 800, 900])->each(function (Role $role) use ($permission) {
            $role->permissions()->detach($permission->id);
        });

        $permission->delete();
    }
};
