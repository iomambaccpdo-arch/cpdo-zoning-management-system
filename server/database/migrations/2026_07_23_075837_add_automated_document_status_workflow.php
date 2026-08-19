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
            DB::statement("ALTER TABLE documents ALTER COLUMN status SET DEFAULT 'encoding'");
        } else {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('status', 50)->default('encoding')->change();
            });
        }

        DB::table('documents')->where('status', 'pending')->update(['status' => 'encoded']);
        DB::table('documents')->where('status', 'processing')->update(['status' => 'inspected']);
        DB::table('documents')->whereIn('status', ['completed', 'finalized'])->update(['status' => 'approved']);

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('encoding', 'returned', 'encoded', 'inspected', 'reviewed', 'approved'))");
        }

        $reviewPermission = Permission::firstOrCreate([
            'resource' => 'Files',
            'name' => 'review_inspection_report',
        ]);

        $approvePermission = Permission::firstOrCreate([
            'resource' => 'Files',
            'name' => 'approve_application',
        ]);

        Role::whereIn('code', [700, 800, 900])->each(function (Role $role) use ($reviewPermission) {
            $role->permissions()->syncWithoutDetaching([$reviewPermission->id]);
        });

        Role::whereIn('code', [800, 900])->each(function (Role $role) use ($approvePermission) {
            $role->permissions()->syncWithoutDetaching([$approvePermission->id]);
        });
    }

    public function down(): void
    {
        $reviewPermission = Permission::where('resource', 'Files')
            ->where('name', 'review_inspection_report')
            ->first();

        $approvePermission = Permission::where('resource', 'Files')
            ->where('name', 'approve_application')
            ->first();

        foreach ([$reviewPermission, $approvePermission] as $permission) {
            if (! $permission) {
                continue;
            }

            Role::all()->each(function (Role $role) use ($permission) {
                $role->permissions()->detach($permission->id);
            });

            $permission->delete();
        }

        DB::table('documents')->where('status', 'encoded')->update(['status' => 'pending']);
        DB::table('documents')->where('status', 'inspected')->update(['status' => 'processing']);
        DB::table('documents')->whereIn('status', ['reviewed', 'approved'])->update(['status' => 'completed']);

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check');
            DB::statement("ALTER TABLE documents ALTER COLUMN status SET DEFAULT 'pending'");
            DB::statement("ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('encoding', 'returned', 'pending', 'processing', 'completed', 'finalized'))");
        } else {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('status', 50)->default('pending')->change();
            });
        }
    }
};
