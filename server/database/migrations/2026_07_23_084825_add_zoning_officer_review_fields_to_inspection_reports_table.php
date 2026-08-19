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
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->text('additional_conditions')->nullable()->after('noted_by_designation');
            $table->string('recommended_for_approval_name')->nullable()->after('additional_conditions');
            $table->string('recommended_for_approval_designation')->nullable()->after('recommended_for_approval_name');
            $table->string('approved_by_name')->nullable()->after('recommended_for_approval_designation');
            $table->string('approved_by_designation')->nullable()->after('approved_by_name');
            $table->timestamp('reviewed_at')->nullable()->after('approved_by_designation');
            $table->foreignId('reviewed_by_user_id')
                ->nullable()
                ->after('reviewed_at')
                ->constrained('users')
                ->nullOnDelete();
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE document_attachments DROP CONSTRAINT IF EXISTS document_attachments_attachment_type_check');
            DB::statement("ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_attachment_type_check CHECK (attachment_type IN ('document', 'oic', 'inspection_photo', 'reviewed_inspection_report'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inspection_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by_user_id');
            $table->dropColumn([
                'additional_conditions',
                'recommended_for_approval_name',
                'recommended_for_approval_designation',
                'approved_by_name',
                'approved_by_designation',
                'reviewed_at',
            ]);
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE document_attachments DROP CONSTRAINT IF EXISTS document_attachments_attachment_type_check');
            DB::statement("ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_attachment_type_check CHECK (attachment_type IN ('document', 'oic', 'inspection_photo'))");
        }
    }
};
