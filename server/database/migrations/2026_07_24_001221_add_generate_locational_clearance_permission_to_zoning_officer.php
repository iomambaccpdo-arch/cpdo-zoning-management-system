<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate([
            'resource' => 'Files',
            'name' => 'generate_locational_clearance',
        ]);

        Role::where('code', 700)->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        });
    }

    public function down(): void
    {
        $permission = Permission::where('resource', 'Files')
            ->where('name', 'generate_locational_clearance')
            ->first();

        if (! $permission) {
            return;
        }

        Role::where('code', 700)->each(function (Role $role) use ($permission) {
            $role->permissions()->detach($permission->id);
        });
    }
};
