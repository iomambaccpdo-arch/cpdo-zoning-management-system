<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->date('date_of_report')->nullable()->after('status');
            $table->text('area_details')->nullable()->after('right_over_land');
            $table->text('location_details')->nullable()->after('area_details');
            $table->string('information_provided_in_order')->nullable()->after('gps_coordinates');
            $table->text('information_provided_findings')->nullable()->after('information_provided_in_order');
            $table->string('abutting_north')->nullable()->after('information_provided_findings');
            $table->string('abutting_south')->nullable()->after('abutting_north');
            $table->string('abutting_east')->nullable()->after('abutting_south');
            $table->string('abutting_west')->nullable()->after('abutting_east');
            $table->string('legal_bases')->nullable()->after('abutting_west');
            $table->string('road_category')->nullable()->after('findings_evaluation');
            $table->string('road_standard_rrow')->nullable()->after('road_category');
            $table->string('road_actual_rrow')->nullable()->after('road_standard_rrow');
            $table->string('road_min_setback')->nullable()->after('road_actual_rrow');
            $table->string('road_as_per_plan')->nullable()->after('road_min_setback');
            $table->text('road_remarks')->nullable()->after('road_as_per_plan');
            $table->string('parking_building_code')->nullable()->after('road_remarks');
            $table->text('parking_space_requirement')->nullable()->after('parking_building_code');
            $table->text('parking_remarks')->nullable()->after('parking_space_requirement');
            $table->string('type_of_lot')->nullable()->after('parking_remarks');
            $table->string('front_setback')->nullable()->after('type_of_lot');
            $table->string('distance_center_line_to_building')->nullable()->after('front_setback');
            $table->string('noted_by_signature')->nullable()->after('inspector_designation');
            $table->string('noted_by_designation')->nullable()->after('noted_by_signature');
        });
    }

    public function down(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->dropColumn([
                'date_of_report',
                'area_details',
                'location_details',
                'information_provided_in_order',
                'information_provided_findings',
                'abutting_north',
                'abutting_south',
                'abutting_east',
                'abutting_west',
                'legal_bases',
                'road_category',
                'road_standard_rrow',
                'road_actual_rrow',
                'road_min_setback',
                'road_as_per_plan',
                'road_remarks',
                'parking_building_code',
                'parking_space_requirement',
                'parking_remarks',
                'type_of_lot',
                'front_setback',
                'distance_center_line_to_building',
                'noted_by_signature',
                'noted_by_designation',
            ]);
        });
    }
};
