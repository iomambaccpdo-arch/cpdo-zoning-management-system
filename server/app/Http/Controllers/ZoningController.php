<?php

namespace App\Http\Controllers;

class ZoningController extends Controller
{
    public function index()
    {
        $zonings = \App\Models\Zoning::with('projectTypes.specificProjectTypes')->get();

        return response()->json($zonings);
    }
}
