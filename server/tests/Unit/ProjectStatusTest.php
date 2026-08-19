<?php

use App\Support\ProjectStatus;

it('defines percentage-based project status options', function () {
    expect(ProjectStatus::options())->toBe([
        'Completed (100%)',
        'Ongoing (76–99%)',
        'Ongoing (51–75%)',
        'Ongoing (26–50%)',
        'Ongoing (1–25%)',
        'No Construction (0%)',
    ]);
});
