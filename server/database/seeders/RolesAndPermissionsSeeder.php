<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Create Permissions
        $permissionsList = config('permissions.list');

        foreach ($permissionsList as $resource => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate([
                    'resource' => $resource,
                    'name' => $action,
                ]);
            }
        }

        // Create Roles
        $superAdminRole = Role::firstOrCreate(['code' => 900], ['name' => 'Super Admin']);
        $coordinatorRole = Role::firstOrCreate(['code' => 800], ['name' => 'Coordinator']);
        $zoningOfficerRole = Role::firstOrCreate(['code' => 700], ['name' => 'Zoning Officer']);
        $zoningInspectorRole = Role::firstOrCreate(['code' => 600], ['name' => 'Zoning Inspector']);
        $encoderClerkRole = Role::firstOrCreate(['code' => 650], ['name' => 'Encoder (Clerk)']);

        // Helper function to get permission IDs based on role config
        $getPermissionIds = function ($roleConfig) {
            $ids = [];
            foreach ($roleConfig as $resource => $actions) {
                $ids = array_merge($ids, Permission::where('resource', $resource)
                    ->whereIn('name', $actions)
                    ->pluck('id')
                    ->toArray());
            }

            return $ids;
        };

        // Assign Permissions to Roles
        $superAdminRole->permissions()->sync($getPermissionIds(config('permissions.roles.super_admin')));

        $coordinatorRole->permissions()->sync($getPermissionIds(config('permissions.roles.coordinator')));

        $zoningOfficerRole->permissions()->sync($getPermissionIds(config('permissions.roles.zoning_officer')));

        $zoningInspectorRole->permissions()->sync($getPermissionIds(config('permissions.roles.zoning_inspector')));

        $encoderClerkRole->permissions()->sync($getPermissionIds(config('permissions.roles.encoder_clerk')));

        // Seed Users
        $superAdminUser = User::firstOrCreate([
            'email' => 'superadmin@example.com',
        ], [
            'first_name' => 'Super',
            'last_name' => 'Admin',
            'designation' => 'System Administrator',
            'section' => 'IT Section',
            'password' => Hash::make('123456789'),
        ]);

        $coordinatorUser = User::firstOrCreate([
            'email' => 'coordinator@example.com',
        ], [
            'first_name' => 'Joseph',
            'last_name' => 'Raymund',
            'designation' => 'CPDC',
            'section' => 'Plans',
            'password' => Hash::make('123456789'),
        ]);

        $officerUser = User::firstOrCreate([
            'email' => 'officer@example.com',
        ], [
            'first_name' => 'Zoning',
            'last_name' => 'Officer',
            'designation' => 'Zoning Officer I',
            'section' => 'Zoning Section',
            'password' => Hash::make('123456789'),
        ]);

        $inspectorUser = User::firstOrCreate([
            'email' => 'inspector@example.com',
        ], [
            'first_name' => 'Zoning',
            'last_name' => 'Inspector',
            'designation' => 'Zoning Inspector',
            'section' => 'Enforcement Section',
            'password' => Hash::make('123456789'),
        ]);

        $encoderUser = User::firstOrCreate([
            'email' => 'encoder@example.com',
        ], [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'designation' => 'Encoder (Clerk)',
            'section' => 'Records Section',
            'password' => Hash::make('123456789'),
        ]);

        // Assign Roles to Users
        $superAdminUser->roles()->sync([$superAdminRole->id]);

        $coordinatorUser->roles()->sync([$coordinatorRole->id]);

        $officerUser->roles()->sync([$zoningOfficerRole->id]);

        $inspectorUser->roles()->sync([$zoningInspectorRole->id]);

        $encoderUser->roles()->sync([$encoderClerkRole->id]);

    }
}
