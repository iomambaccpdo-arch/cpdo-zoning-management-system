<?php

return [
    'list' => [
        'Dashboard' => ['view'],
        'Files' => [
            'view',
            'create',
            'update',
            'delete',
            'extend_due_date',
            'inspection_report',
            'generate_locational_clearance',
            'submit_application',
            'review_inspection_report',
            'approve_application',
        ],
        'Accounts' => ['view', 'create', 'update', 'delete'],
        'Activity Logs' => ['view'],
    ],
    'roles' => [
        'super_admin' => [
            'Dashboard' => ['view'],
            'Files' => [
                'view',
                'create',
                'update',
                'delete',
                'extend_due_date',
                'inspection_report',
                'generate_locational_clearance',
                'submit_application',
                'review_inspection_report',
                'approve_application',
            ],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'coordinator' => [
            'Dashboard' => ['view'],
            'Files' => [
                'view',
                'create',
                'update',
                'delete',
                'extend_due_date',
                'inspection_report',
                'generate_locational_clearance',
                'submit_application',
                'review_inspection_report',
                'approve_application',
            ],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'zoning_officer' => [
            'Dashboard' => ['view'],
            'Files' => [
                'view',
                'create',
                'review_inspection_report',
                'generate_locational_clearance',
            ],
        ],
        'zoning_inspector' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'inspection_report'],
        ],
        'encoder_clerk' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create', 'update', 'submit_application'],
        ],
    ],
];
