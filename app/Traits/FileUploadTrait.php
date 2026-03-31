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
    public function buildAttachmentPayload(UploadedFile $file, string $storedPath, ?string $forcedType = null): array
    {
        $mime = $file->getClientMimeType();
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: '');

        return [
            'path' => $storedPath,
            'name' => $file->getClientOriginalName(),
            'mime' => $mime,
            'type' => $forcedType ?: $this->detectAttachmentType($mime, $extension),
            'size' => $this->resolveAttachmentSize($file, $storedPath),
        ];
    }

    protected function storeUploadedFile(UploadedFile $file, string $path = 'uploads'): string
    {
        $directory = $this->resolveUploadDirectory($path);

        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        if (! is_writable($directory)) {
            @chmod($directory, 0775);
        }

        if (! is_writable($directory)) {
            @chmod($directory, 0777);
        }

        if (! is_writable($directory)) {
            throw new \RuntimeException("Unable to write in the \"{$directory}\" directory.");
        }

        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin';
        $fileName = 'media_' . uniqid() . '.' . $ext;

        $file->move($directory, $fileName);

        return $path . '/' . $fileName;
    }

    protected function resolveAttachmentSize(UploadedFile $file, string $storedPath): ?int
    {
        try {
            $size = $file->getSize();

            if (is_int($size) && $size >= 0) {
                return $size;
            }
        } catch (\Throwable $throwable) {
            // The uploaded file may already have been moved to its final path.
        }

        $absolutePath = $this->resolveStoredUploadPath($storedPath);

        if (is_file($absolutePath)) {
            clearstatcache(true, $absolutePath);
            $size = @filesize($absolutePath);

            if ($size !== false) {
                return (int) $size;
            }
        }

        return null;
    }

    protected function resolveUploadBasePath(): string
    {
        return rtrim((string) config('messenger.upload_base_path', public_path()), DIRECTORY_SEPARATOR);
    }

    protected function resolveUploadDirectory(string $path): string
    {
        return $this->resolveUploadBasePath() . DIRECTORY_SEPARATOR . ltrim($path, DIRECTORY_SEPARATOR);
    }

    protected function resolveStoredUploadPath(string $storedPath): string
    {
        return $this->resolveUploadBasePath() . DIRECTORY_SEPARATOR . ltrim($storedPath, DIRECTORY_SEPARATOR);
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
