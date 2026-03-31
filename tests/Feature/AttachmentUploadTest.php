<?php

use App\Models\Message;
use App\Models\User;
use App\Traits\FileUploadTrait;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;

function makeAttachmentUploader()
{
    return new class
    {
        use FileUploadTrait;

        public function storeAndBuild(UploadedFile $file, string $path, ?string $forcedType = null): array
        {
            $storedPath = $this->storeUploadedFile($file, $path);

            return $this->buildAttachmentPayload($file, $storedPath, $forcedType);
        }
    };
}

afterEach(function () {
    File::deleteDirectory(public_path('uploads/tests'));
    File::deleteDirectory(storage_path('framework/testing/uploads'));
});

it('captures video attachment metadata after moving the uploaded file', function () {
    $uploader = makeAttachmentUploader();
    $file = UploadedFile::fake()->create('demo-video.mp4', 512, 'video/mp4');

    $payload = $uploader->storeAndBuild($file, 'uploads/tests');

    expect($payload['type'])->toBe('video');
    expect($payload['size'])->toBeInt()->toBeGreaterThan(0);
    expect($payload['path'])->toStartWith('uploads/tests/');
});

it('captures voice attachment metadata after moving the uploaded file', function () {
    $uploader = makeAttachmentUploader();
    $file = UploadedFile::fake()->create('voice-note.webm', 256, 'audio/webm');

    $payload = $uploader->storeAndBuild($file, 'uploads/tests', 'audio');

    expect($payload['type'])->toBe('audio');
    expect($payload['size'])->toBeInt()->toBeGreaterThan(0);
    expect($payload['path'])->toStartWith('uploads/tests/');
});

it('stores a video attachment through the messenger send endpoint', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $video = UploadedFile::fake()->create('launch-demo.mp4', 512, 'video/mp4');

    config()->set('messenger.upload_base_path', storage_path('framework/testing/uploads'));

    $response = $this->actingAs($sender)->post(route('messenger.send-message'), [
        'id' => $recipient->id,
        'temporaryMsgId' => 'temp_video_1',
        'message' => 'Here is the clip',
        'attachments' => [$video],
    ]);

    $response->assertOk()
        ->assertJsonStructure(['message', 'tempID']);

    $message = Message::latest('id')->firstOrFail();
    $attachments = $message->attachmentItems();

    expect($message->message_type)->toBe('media');
    expect($attachments)->toHaveCount(1);
    expect($attachments[0]['type'])->toBe('video');
    expect($attachments[0]['size'])->toBeInt()->toBeGreaterThan(0);

    $storedFile = storage_path('framework/testing/uploads/' . $attachments[0]['path']);

    if (is_file($storedFile)) {
        @unlink($storedFile);
    }
});

it('stores voice note duration metadata through the messenger send endpoint', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $voice = UploadedFile::fake()->create('voice-note.mp3', 256, 'audio/mpeg');

    config()->set('messenger.upload_base_path', storage_path('framework/testing/uploads'));

    $response = $this->actingAs($sender)->post(route('messenger.send-message'), [
        'id' => $recipient->id,
        'temporaryMsgId' => 'temp_voice_1',
        'message' => 'Voice check',
        'voice_message' => $voice,
        'voice_duration_seconds' => 12,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['message', 'tempID']);

    $message = Message::latest('id')->firstOrFail();
    $attachments = $message->attachmentItems();

    expect($message->message_type)->toBe('voice');
    expect($message->voiceNoteDurationSeconds())->toBe(12);
    expect($message->voiceNoteDurationLabel())->toBe('0:12');
    expect($attachments)->toHaveCount(1);
    expect($attachments[0]['type'])->toBe('audio');
    expect($response->json('message'))->toContain('0:12');

    $storedFile = storage_path('framework/testing/uploads/' . $attachments[0]['path']);

    if (is_file($storedFile)) {
        @unlink($storedFile);
    }
});
