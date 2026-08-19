<?php

use App\Support\ZoningClassification;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('zonings')->orderBy('id')->get(['id', 'name'])->each(function (object $zoning): void {
            $normalized = ZoningClassification::format($zoning->name);

            if ($normalized === '' || $normalized === $zoning->name) {
                return;
            }

            $duplicate = DB::table('zonings')
                ->where('name', $normalized)
                ->where('id', '!=', $zoning->id)
                ->exists();

            if ($duplicate) {
                return;
            }

            DB::table('zonings')
                ->where('id', $zoning->id)
                ->update(['name' => $normalized]);
        });
    }

    public function down(): void
    {
        // Irreversible data normalization.
    }
};
