<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inspection_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->unique()->constrained('documents')->onDelete('cascade');
            $table->foreignId('inspector_id')->constrained('users')->onDelete('cascade');
            $table->string('status')->default('draft');
            $table->string('project_life_span')->nullable();
            $table->string('project_significance')->nullable();
            $table->string('right_over_land')->nullable();
            $table->date('inspection_date')->nullable();
            $table->string('project_status_as_of_inspection')->nullable();
            $table->string('gps_coordinates')->nullable();
            $table->text('existing_land_uses_abutting')->nullable();
            $table->text('findings_evaluation')->nullable();
            $table->text('road_category_info')->nullable();
            $table->text('setback_requirements')->nullable();
            $table->text('parking_space_requirements')->nullable();
            $table->string('decision_recommended')->nullable();
            $table->text('remarks')->nullable();
            $table->string('inspector_signature')->nullable();
            $table->string('inspector_designation')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_reports');
    }
};
