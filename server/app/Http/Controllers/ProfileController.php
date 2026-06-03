<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'designation' => 'required|string|max:255',
            'section' => 'required|string|max:255',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

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

        Document::query()
            ->where('received_by_user_id', $user->id)
            ->update(['received_by' => $user->fullName()]);

        return response()->json($user->load('roles.permissions')->append('permissions'));
    }
}
