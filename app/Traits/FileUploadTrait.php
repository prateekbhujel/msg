<?php

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

Trait FileUploadTrait 
{

    /**
     * Uploads a file to the specified path.
     *
     * @param \Illuminate\Http\Request $request The request object containing the file to be uploaded.
     * @param string $inputName The name of the input field containing the file.
     * @param string|null $oldPath The path of the old file to be replaced, if any.
     * @param string $path The path to upload the file to, relative to the public directory.
     * @return string|null The path of the uploaded file, or null if no file was uploaded.
     */
    public function uploadFile(Request $request, string $inputName, ?string $oldPath = null, string $path = 'uploads')
    {
        if ($request->hasFile($inputName)) {
            $file = $request->file($inputName);

            if ($file instanceof UploadedFile) {
                return $this->storeUploadedFile($file, $path);
            }
        }

        return null;

    } //End Method

    /**
     * Uploads multiple files and returns the stored paths.
     *
     * @param \Illuminate\Http\Request $request
     * @param string $inputName
     * @param string $path
     * @return array<int, string>
     */
    public function uploadFiles(Request $request, string $inputName, string $path = 'uploads'): array
    {
        if (! $request->hasFile($inputName)) {
            return [];
        }

        $files = $request->file($inputName);
        $files = is_array($files) ? $files : [$files];

        $paths = [];

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $paths[] = $this->storeUploadedFile($file, $path);
            }
        }

        return $paths;
    }

    /**
     * Builds file metadata for the messenger attachment payload.
     *
     * @param \Illuminate\Http\UploadedFile $file
     * @param string $storedPath
     * @return array<string, mixed>
     */
    public function buildAttachmentPayload(UploadedFile $file, string $storedPath): array
    {
        $mime = $file->getClientMimeType();
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: '');

        return [
            'path' => $storedPath,
            'name' => $file->getClientOriginalName(),
            'mime' => $mime,
            'type' => $this->detectAttachmentType($mime, $extension),
            'size' => $file->getSize(),
        ];
    }

    protected function storeUploadedFile(UploadedFile $file, string $path = 'uploads'): string
    {
        if (! is_dir(public_path($path))) {
            mkdir(public_path($path), 0775, true);
        }

        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin';
        $fileName = 'media_' . uniqid() . '.' . $ext;

        $file->move(public_path($path), $fileName);

        return $path . '/' . $fileName;
    }

    protected function detectAttachmentType(?string $mime, string $extension): string
    {
        if ($mime) {
            if (str_starts_with($mime, 'image/')) {
                return 'image';
            }

            if (str_starts_with($mime, 'audio/')) {
                return 'audio';
            }

            if (str_starts_with($mime, 'video/')) {
                return 'video';
            }
        }

        return match ($extension) {
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif' => 'image',
            'mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm' => 'audio',
            'mp4', 'mov', 'mkv' => 'video',
            default => 'file',
        };
    }

} 
