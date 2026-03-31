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
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('group_id')->nullable()->after('to_id')->constrained('chat_groups')->nullOnDelete();
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('CREATE TABLE messages_temp AS SELECT * FROM messages');
            Schema::dropIfExists('messages');

            Schema::create('messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('from_id');
                $table->foreignId('to_id')->nullable();
                $table->foreignId('group_id')->nullable()->constrained('chat_groups')->nullOnDelete();
                $table->text('body')->nullable();
                $table->json('attachment')->nullable();
                $table->boolean('seen')->default(0);
                $table->string('message_type')->default('text');
                $table->json('meta')->nullable();
                $table->foreignId('reply_to_id')->nullable()->constrained('messages')->nullOnDelete();
                $table->timestamps();
            });

            DB::statement('
                INSERT INTO messages (id, from_id, to_id, group_id, body, attachment, seen, message_type, meta, reply_to_id, created_at, updated_at)
                SELECT id, from_id, to_id, group_id, body, attachment, seen, message_type, meta, reply_to_id, created_at, updated_at
                FROM messages_temp
            ');
            Schema::dropIfExists('messages_temp');
        } else {
            DB::statement('ALTER TABLE messages MODIFY to_id BIGINT UNSIGNED NULL');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('CREATE TABLE messages_temp AS SELECT * FROM messages');
            Schema::dropIfExists('messages');

            Schema::create('messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('from_id');
                $table->foreignId('to_id');
                $table->text('body')->nullable();
                $table->json('attachment')->nullable();
                $table->boolean('seen')->default(0);
                $table->string('message_type')->default('text');
                $table->json('meta')->nullable();
                $table->foreignId('reply_to_id')->nullable()->constrained('messages')->nullOnDelete();
                $table->timestamps();
            });

            DB::statement('
                INSERT INTO messages (id, from_id, to_id, body, attachment, seen, message_type, meta, reply_to_id, created_at, updated_at)
                SELECT id, from_id, COALESCE(to_id, from_id), body, attachment, seen, message_type, meta, reply_to_id, created_at, updated_at
                FROM messages_temp
            ');
            Schema::dropIfExists('messages_temp');
        } else {
            DB::statement('ALTER TABLE messages MODIFY to_id BIGINT UNSIGNED NOT NULL');
            Schema::table('messages', function (Blueprint $table) {
                $table->dropConstrainedForeignId('group_id');
            });
        }
    }
};
