<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->string('lacking_documents')->nullable()->after('type_of_lot');
            $table->json('parking_as_per_plan')->nullable()->after('parking_space_requirement');
        });
    }

    public function down(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->dropColumn(['lacking_documents', 'parking_as_per_plan']);
        });
    }
};
