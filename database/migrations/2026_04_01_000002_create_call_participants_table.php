<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('call_participants')) {
            return;
        }

        Schema::create('call_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_id')->constrained('call_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['ringing', 'accepted', 'declined', 'missed', 'left'])->default('ringing');
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['call_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_participants');
    }
};
