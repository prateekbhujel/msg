<?php

namespace App\Traits;

use Illuminate\Http\Request;

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
            $file = $request->{$inputName};
            $ext = $file->getClientOriginalExtension();
            $fileName = 'media_' . uniqid() . '.' . $ext;

            $file->move(public_path($path), $fileName);

            return $path . '/' . $fileName;
        }

        return null;

    } //End Method

}