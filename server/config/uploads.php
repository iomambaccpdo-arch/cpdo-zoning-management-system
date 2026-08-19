<?php

return [

    /*
    |--------------------------------------------------------------------------
    | PDF upload limits (Laravel validation)
    |--------------------------------------------------------------------------
    |
    | PHP must allow at least these sizes (see server/php.ini and TURNOVER.md).
    | Laravel "max" rule for files is in kilobytes.
    |
    */

    'max_file_size_kb' => (int) env('UPLOAD_MAX_FILE_MB', 64) * 1024,

    'max_files_per_request' => (int) env('UPLOAD_MAX_FILES_PER_REQUEST', 20),

    'max_image_size_kb' => (int) env('UPLOAD_MAX_IMAGE_MB', 10) * 1024,

];
