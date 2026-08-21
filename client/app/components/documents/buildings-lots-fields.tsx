import { Plus, Trash2 } from "lucide-react"
import type { Control, FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove } from "react-hook-form"
import { Button } from "~/components/ui/button"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input, InputUnitAddon } from "~/components/ui/input"
import { emptyBuildingEntry, emptyLotEntry } from "~/lib/document-property-utils"
import { AREA_UNIT } from "~/lib/measurement-utils"

type BuildingsLotsFormValues = {
    buildings: { name: string; area: string }[]
    lots: { landTitle: string; area: string }[]
}

interface BuildingsLotsFieldsProps {
    control: Control<any>
    buildingFields: FieldArrayWithId<BuildingsLotsFormValues, "buildings", "id">[]
    appendBuilding: UseFieldArrayAppend<BuildingsLotsFormValues, "buildings">
    removeBuilding: UseFieldArrayRemove
    lotFields: FieldArrayWithId<BuildingsLotsFormValues, "lots", "id">[]
    appendLot: UseFieldArrayAppend<BuildingsLotsFormValues, "lots">
    removeLot: UseFieldArrayRemove
}

export function BuildingsLotsFields({
    control,
    buildingFields,
    appendBuilding,
    removeBuilding,
    lotFields,
    appendLot,
    removeLot,
}: BuildingsLotsFieldsProps) {
    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-800">Buildings</h4>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendBuilding(emptyBuildingEntry())}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Building
                    </Button>
                </div>

                {buildingFields.map((field, index) => (
                    <div key={field.id} className="rounded-md border border-zinc-200 p-4 space-y-3 bg-green-50/30">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-zinc-700">Building {index + 1}</p>
                            {buildingFields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => removeBuilding(index)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Remove
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={control}
                                name={`buildings.${index}.name`}
                                render={({ field: inputField }) => (
                                    <FormItem>
                                        <FormLabel>Building Name *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g. Main Building"
                                                className="bg-green-50/50"
                                                {...inputField}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`buildings.${index}.area`}
                                render={({ field: inputField }) => (
                                    <FormItem>
                                        <FormLabel>Building Area *</FormLabel>
                                        <InputUnitAddon unit={AREA_UNIT}>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="bg-green-50/50"
                                                    {...inputField}
                                                />
                                            </FormControl>
                                        </InputUnitAddon>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-800">Lots</h4>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendLot(emptyLotEntry())}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Lot
                    </Button>
                </div>

                {lotFields.map((field, index) => (
                    <div key={field.id} className="rounded-md border border-zinc-200 p-4 space-y-3 bg-green-50/30">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-zinc-700">Lot {index + 1}</p>
                            {lotFields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => removeLot(index)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Remove
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={control}
                                name={`lots.${index}.landTitle`}
                                render={({ field: inputField }) => (
                                    <FormItem>
                                        <FormLabel>Land Title / TCT Number *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g. TCT-123456"
                                                className="bg-green-50/50"
                                                {...inputField}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`lots.${index}.area`}
                                render={({ field: inputField }) => (
                                    <FormItem>
                                        <FormLabel>Lot Area *</FormLabel>
                                        <InputUnitAddon unit={AREA_UNIT}>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    className="bg-green-50/50"
                                                    {...inputField}
                                                />
                                            </FormControl>
                                        </InputUnitAddon>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
