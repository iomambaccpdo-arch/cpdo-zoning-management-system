<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        $setting = Setting::query()->first();

        return response()->json([
            'number_of_days' => $setting?->number_of_days ?? 12,
        ]);
    }
}
