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
            'name' => 'extend_due_date',
        ]);

        Role::whereIn('code', [800, 900])->each(function (Role $role) use ($permission) {
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        });
    }

    public function down(): void
    {
        $permission = Permission::where('resource', 'Files')
            ->where('name', 'extend_due_date')
            ->first();

        if (! $permission) {
            return;
        }

        Role::whereIn('code', [800, 900])->each(function (Role $role) use ($permission) {
            $role->permissions()->detach($permission->id);
        });

        $permission->delete();
    }
};
