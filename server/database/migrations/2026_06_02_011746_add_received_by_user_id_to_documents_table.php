<?php

use App\Models\Document;
use App\Models\User;
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
            $table->foreignId('received_by_user_id')
                ->nullable()
                ->after('received_by')
                ->constrained('users')
                ->nullOnDelete();
        });

        foreach (Document::query()->whereNull('received_by_user_id')->cursor() as $document) {
            $receivedBy = trim($document->received_by);

            if ($receivedBy === '') {
                continue;
            }

            $user = User::query()
                ->get()
                ->first(fn (User $candidate) => $candidate->fullName() === $receivedBy);

            if ($user) {
                $document->update(['received_by_user_id' => $user->id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('received_by_user_id');
        });
    }
};
