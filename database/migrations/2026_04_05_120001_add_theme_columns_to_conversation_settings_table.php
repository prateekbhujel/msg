<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('conversation_settings')) {
            return;
        }

        if (! Schema::hasColumn('conversation_settings', 'theme_primary') || ! Schema::hasColumn('conversation_settings', 'theme_light')) {
            Schema::table('conversation_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('conversation_settings', 'theme_primary')) {
                    $table->string('theme_primary', 7)->nullable()->after('disappear_after');
                }

                if (! Schema::hasColumn('conversation_settings', 'theme_light')) {
                    $table->string('theme_light', 7)->nullable()->after('theme_primary');
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('conversation_settings')) {
            return;
        }

        Schema::table('conversation_settings', function (Blueprint $table) {
            if (Schema::hasColumn('conversation_settings', 'theme_light')) {
                $table->dropColumn('theme_light');
            }

            if (Schema::hasColumn('conversation_settings', 'theme_primary')) {
                $table->dropColumn('theme_primary');
            }
        });
    }
};
