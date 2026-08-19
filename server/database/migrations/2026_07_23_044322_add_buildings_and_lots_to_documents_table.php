<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->json('buildings')->nullable()->after('coordinates');
            $table->json('lots')->nullable()->after('buildings');
        });

        $documents = DB::table('documents')->select('id', 'floor_area', 'lot_area')->get();

        foreach ($documents as $document) {
            $buildings = [];
            $lots = [];

            if (filled($document->floor_area)) {
                $buildings[] = [
                    'name' => 'Building 1',
                    'area' => (string) $document->floor_area,
                ];
            }

            if (filled($document->lot_area)) {
                $lots[] = [
                    'land_title' => 'N/A',
                    'area' => (string) $document->lot_area,
                ];
            }

            DB::table('documents')->where('id', $document->id)->update([
                'buildings' => json_encode($buildings),
                'lots' => json_encode($lots),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['buildings', 'lots']);
        });
    }
};
