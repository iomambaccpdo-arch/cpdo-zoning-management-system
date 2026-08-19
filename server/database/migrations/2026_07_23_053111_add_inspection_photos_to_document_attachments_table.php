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
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE document_attachments DROP CONSTRAINT IF EXISTS document_attachments_attachment_type_check');
            DB::statement('ALTER TABLE document_attachments ALTER COLUMN attachment_type TYPE VARCHAR(50) USING attachment_type::text');
            DB::statement("ALTER TABLE document_attachments ALTER COLUMN attachment_type SET DEFAULT 'document'");
            DB::statement("ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_attachment_type_check CHECK (attachment_type IN ('document', 'oic', 'inspection_photo'))");
        } elseif ($driver === 'sqlite') {
            // SQLite stores enums as strings; recreate the check via a no-op change for fresh schemas.
        } else {
            Schema::table('document_attachments', function (Blueprint $table) {
                $table->string('attachment_type', 50)->default('document')->change();
            });
        }

        Schema::table('document_attachments', function (Blueprint $table) {
            $table->foreignId('inspection_report_id')
                ->nullable()
                ->after('document_id')
                ->constrained('inspection_reports')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_attachments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inspection_report_id');
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE document_attachments DROP CONSTRAINT IF EXISTS document_attachments_attachment_type_check');
            DB::statement("ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_attachment_type_check CHECK (attachment_type IN ('document', 'oic'))");
        }
    }
};
