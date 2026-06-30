<?php

return [
    'list' => [
        'Dashboard' => ['view'],
        'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date', 'inspection_report', 'generate_locational_clearance'],
        'Accounts' => ['view', 'create', 'update', 'delete'],
        'Activity Logs' => ['view'],
    ],
    'roles' => [
        'super_admin' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date', 'inspection_report', 'generate_locational_clearance'],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'coordinator' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date', 'inspection_report', 'generate_locational_clearance'],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'section_head' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'update', 'generate_locational_clearance'],
        ],
        'zoning_officer' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create'],
        ],
        'zoning_inspector' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'inspection_report'],
        ],
    ],
];
