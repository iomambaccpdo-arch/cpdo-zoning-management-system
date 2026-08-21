<?php

use App\Support\ProjectTypeClassification;

it('formats encoded and verified project type labels', function () {
    expect(ProjectTypeClassification::formatLabel('Warehouse', null))->toBe('Warehouse')
        ->and(ProjectTypeClassification::formatLabel('Warehouse', 'N/A'))->toBe('Warehouse')
        ->and(ProjectTypeClassification::formatLabel('Warehouse', 'Cold Storage'))->toBe('Warehouse — Cold Storage')
        ->and(ProjectTypeClassification::formatLabel(null, null))->toBe('—');
});

it('formats locational clearance project type with zoning, type, and specific type', function () {
    expect(ProjectTypeClassification::formatClearanceLabel(
        'Section 12.11. Regulations in Commercial-1 (C-1) Zone',
        'Commercial housing',
        'Hotel',
    ))->toBe("Commercial-1 (C-1) Zone\nCommercial housing\nSpecific Project Type: Hotel");

    expect(ProjectTypeClassification::formatClearanceLabel('Residential Zone', 'Single Detached', 'N/A'))
        ->toBe("Residential Zone\nSingle Detached");

    expect(ProjectTypeClassification::formatClearanceLabel('General Commercial Zone', 'Warehouse', null))
        ->toBe("General Commercial Zone\nWarehouse");

    expect(ProjectTypeClassification::formatClearanceLabel(null, null, null))->toBe('—');
});

it('parses ordinance ids from a verification entry', function () {
    expect(ProjectTypeClassification::idsFromEntry([
        'zoning_id' => '4',
        'project_type_id' => 12,
        'specific_project_type_id' => 'N/A',
    ]))->toBe([
        'zoning_id' => 4,
        'project_type_id' => 12,
        'specific_project_type_id' => null,
    ]);
});
