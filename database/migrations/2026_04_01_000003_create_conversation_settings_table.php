<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('conversation_settings')) {
            return;
        }

        Schema::create('conversation_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('direct_user_a_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('direct_user_b_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('chat_groups')->cascadeOnDelete();
            $table->enum('disappear_after', ['off', '24h', '7d'])->default('off');
            $table->timestamps();

            $table->unique(['direct_user_a_id', 'direct_user_b_id'], 'conversation_settings_direct_pair_unique');
            $table->unique(['group_id'], 'conversation_settings_group_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_settings');
    }
};
