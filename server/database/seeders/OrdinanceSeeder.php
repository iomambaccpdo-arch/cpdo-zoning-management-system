<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class OrdinanceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = base_path('Zoning Ordinance_v2.json');
        if (! file_exists($jsonPath)) {
            return;
        }

        $data = json_decode(file_get_contents($jsonPath), true);
        $currentZoning = null;
        $currentProjectType = null;

        foreach ($data as $item) {
            $zoningName = trim($item['ZONING'] ?? '');
            $projectTypeName = trim($item['Type of Project'] ?? '');
            $specificProjectTypeName = trim($item['Specific Project Type'] ?? '');

            if ($zoningName === '' && $projectTypeName === '' && $specificProjectTypeName === '') {
                continue;
            }

            if ($zoningName !== '') {
                $currentZoning = \App\Models\Zoning::firstOrCreate(['name' => $zoningName]);
                $currentProjectType = null;
            }

            if ($projectTypeName !== '') {
                if ($currentZoning) {
                    $currentProjectType = \App\Models\ProjectType::firstOrCreate([
                        'zoning_id' => $currentZoning->id,
                        'name' => $projectTypeName,
                    ]);
                }
            }

            if ($specificProjectTypeName !== '') {
                if ($currentProjectType) {
                    \App\Models\SpecificProjectType::firstOrCreate([
                        'project_type_id' => $currentProjectType->id,
                        'name' => $specificProjectTypeName,
                    ]);
                }
            }
        }
    }
}
