<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('inspection_reports')
            ->select('id', 'parking_space_requirement')
            ->whereNotNull('parking_space_requirement')
            ->get();

        foreach ($rows as $row) {
            $decoded = json_decode((string) $row->parking_space_requirement, true);

            if (is_array($decoded)) {
                continue;
            }

            DB::table('inspection_reports')
                ->where('id', $row->id)
                ->update(['parking_space_requirement' => null]);
        }
    }

    public function down(): void
    {
        //
    }
};
