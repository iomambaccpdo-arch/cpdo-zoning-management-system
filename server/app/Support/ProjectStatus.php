<?php

namespace App\Support;

class ProjectStatus
{
    /**
     * Percentage-based project status options as of inspection date.
     *
     * @return list<string>
     */
    public static function options(): array
    {
        return [
            'Completed (100%)',
            'Ongoing (76–99%)',
            'Ongoing (51–75%)',
            'Ongoing (26–50%)',
            'Ongoing (1–25%)',
            'No Construction (0%)',
        ];
    }
}
