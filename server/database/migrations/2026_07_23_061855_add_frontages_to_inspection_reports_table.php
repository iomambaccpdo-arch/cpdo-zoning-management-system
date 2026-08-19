<?php

use App\Support\FrontageRoads;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->json('frontages')->nullable()->after('findings_evaluation');
        });

        $rows = DB::table('inspection_reports')
            ->select([
                'id',
                'road_category',
                'road_standard_rrow',
                'road_actual_rrow',
                'road_min_setback',
                'road_as_per_plan',
                'front_setback',
            ])
            ->get();

        foreach ($rows as $row) {
            $frontages = FrontageRoads::fromLegacy([
                'road_category' => $row->road_category,
                'road_standard_rrow' => $row->road_standard_rrow,
                'road_actual_rrow' => $row->road_actual_rrow,
                'road_min_setback' => $row->road_min_setback,
                'road_as_per_plan' => $row->road_as_per_plan,
                'front_setback' => $row->front_setback,
            ]);

            DB::table('inspection_reports')
                ->where('id', $row->id)
                ->update(['frontages' => json_encode($frontages)]);
        }
    }

    public function down(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->dropColumn('frontages');
        });
    }
};
