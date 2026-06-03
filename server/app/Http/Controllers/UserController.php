<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles')->whereDoesntHave('roles', function ($q) {
            $q->where('code', 900);
        });

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('designation', 'like', "%{$search}%")
                    ->orWhere('section', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 10);
        $users = $query->paginate($perPage);

        return response()->json($users);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'designation' => 'required|string|max:255',
            'section' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
            'roles' => 'required|array',
            'roles.*' => 'exists:roles,id',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = User::create([
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'designation' => $validated['designation'],
                'section' => $validated['section'],
                'password' => Hash::make($validated['password']),
            ]);

            $user->roles()->sync($validated['roles']);

            ActivityLogger::log(
                'create',
                'accounts',
                $user->email,
                "Created account: {$user->first_name} {$user->last_name} ({$user->email})"
            );

            return response()->json($user->load('roles'), 201);
        });
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'designation' => 'required|string|max:255',
            'section' => 'required|string|max:255',
            'password' => 'nullable|string|min:8|confirmed',
            'roles' => 'required|array',
            'roles.*' => 'exists:roles,id',
        ]);

        return DB::transaction(function () use ($validated, $user, $request) {
            $userData = [
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'designation' => $validated['designation'],
                'section' => $validated['section'],
            ];

            if ($request->filled('password')) {
                $userData['password'] = Hash::make($validated['password']);
            }

            $user->update($userData);
            $user->roles()->sync($validated['roles']);

            Document::query()
                ->where('received_by_user_id', $user->id)
                ->update(['received_by' => $user->fullName()]);

            ActivityLogger::log(
                'update',
                'accounts',
                $user->email,
                "Updated account: {$user->first_name} {$user->last_name} ({$user->email})"
            );

            return response()->json($user->load('roles'));
        });
    }

    public function destroy(User $user)
    {
        ActivityLogger::log(
            'delete',
            'accounts',
            $user->email,
            "Deleted account: {$user->first_name} {$user->last_name} ({$user->email})"
        );
        $user->delete();

        return response()->json(null, 204);
    }
}
