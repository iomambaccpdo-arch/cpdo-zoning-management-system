<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check');
            DB::statement('ALTER TABLE documents ALTER COLUMN status TYPE VARCHAR(50) USING status::text');
            DB::statement("ALTER TABLE documents ALTER COLUMN status SET DEFAULT 'pending'");
            DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('encoding', 'returned', 'pending', 'processing', 'completed', 'finalized'))");
        } else {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('status', 50)->default('pending')->change();
            });
        }

        $submitPermission = Permission::firstOrCreate([
            'resource' => 'Files',
            'name' => 'submit_application',
        ]);

        $viewPermission = Permission::where('resource', 'Files')->where('name', 'view')->first();
        $createPermission = Permission::where('resource', 'Files')->where('name', 'create')->first();
        $updatePermission = Permission::where('resource', 'Files')->where('name', 'update')->first();
        $dashboardPermission = Permission::where('resource', 'Dashboard')->where('name', 'view')->first();

        $encoderRole = Role::firstOrCreate(['code' => 650], ['name' => 'Encoder (Clerk)']);

        $permissionIds = collect([
            $dashboardPermission?->id,
            $viewPermission?->id,
            $createPermission?->id,
            $updatePermission?->id,
            $submitPermission->id,
        ])->filter()->values()->all();

        $encoderRole->permissions()->syncWithoutDetaching($permissionIds);
    }

    public function down(): void
    {
        $encoderRole = Role::where('code', 650)->first();

        if ($encoderRole) {
            $encoderRole->permissions()->detach();
            $encoderRole->delete();
        }

        $permission = Permission::where('resource', 'Files')
            ->where('name', 'submit_application')
            ->first();

        if ($permission) {
            Role::all()->each(function (Role $role) use ($permission) {
                $role->permissions()->detach($permission->id);
            });

            $permission->delete();
        }

        DB::table('documents')
            ->whereIn('status', ['encoding', 'returned'])
            ->update(['status' => 'pending']);

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check');
            DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('pending', 'processing', 'completed', 'finalized'))");
        } else {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('status', 50)->default('pending')->change();
            });
        }
    }
};
