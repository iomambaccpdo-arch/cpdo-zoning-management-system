<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('or_number')->nullable()->after('status');
            $table->decimal('amount_paid', 12, 2)->nullable()->after('or_number');
            $table->date('date_paid')->nullable()->after('amount_paid');
            $table->date('date_requirements_complied')->nullable()->after('date_paid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn([
                'or_number',
                'amount_paid',
                'date_paid',
                'date_requirements_complied',
            ]);
        });
    }
};
