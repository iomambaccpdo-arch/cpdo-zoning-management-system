<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fold legal bases into findings before dropping the column.
        $reports = DB::table('inspection_reports')
            ->whereNotNull('legal_bases')
            ->where('legal_bases', '!=', '')
            ->get(['id', 'legal_bases', 'findings_evaluation']);

        foreach ($reports as $report) {
            $legalBases = trim((string) $report->legal_bases);
            $findings = trim((string) ($report->findings_evaluation ?? ''));

            if ($legalBases === '') {
                continue;
            }

            if ($findings === '') {
                $merged = $legalBases;
            } elseif (str_contains($findings, $legalBases)) {
                $merged = $findings;
            } else {
                $merged = $legalBases."\n\n".$findings;
            }

            DB::table('inspection_reports')
                ->where('id', $report->id)
                ->update(['findings_evaluation' => $merged]);
        }

        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->dropColumn([
                'project_life_span',
                'information_provided_in_order',
                'information_provided_findings',
                'legal_bases',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->string('project_life_span')->nullable()->after('date_of_report');
            $table->string('information_provided_in_order')->nullable()->after('gps_coordinates');
            $table->text('information_provided_findings')->nullable()->after('information_provided_in_order');
            $table->string('legal_bases')->nullable()->after('abutting_west');
        });
    }
};
