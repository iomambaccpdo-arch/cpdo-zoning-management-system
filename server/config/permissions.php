<?php

return [
    'list' => [
        'Dashboard' => ['view'],
        'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date'],
        'Accounts' => ['view', 'create', 'update', 'delete'],
        'Activity Logs' => ['view'],
    ],
    'roles' => [
        'super_admin' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date'],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'coordinator' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create', 'update', 'delete', 'extend_due_date'],
            'Accounts' => ['view', 'create', 'update', 'delete'],
            'Activity Logs' => ['view'],
        ],
        'zoning_officer' => [
            'Dashboard' => ['view'],
            'Files' => ['view', 'create'],
        ],
        'zoning_inspector' => [
            'Dashboard' => ['view'],
            'Files' => ['view'],
        ],
    ],
];
