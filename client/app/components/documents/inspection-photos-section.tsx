import * as React from "react"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Eye, ImagePlus, Loader2, Trash2, Upload } from "lucide-react"

import { toast } from "sonner"

import { DocumentService, type DocumentAttachment } from "~/api/DocumentService"

import { AuthenticatedImage } from "~/components/files/authenticated-image"

import { ImagePreviewModal } from "~/components/files/image-preview-modal"

import { Button } from "~/components/ui/button"

import {

    AlertDialog,

    AlertDialogAction,

    AlertDialogCancel,

    AlertDialogContent,

    AlertDialogDescription,

    AlertDialogFooter,

    AlertDialogHeader,

    AlertDialogTitle,

} from "~/components/ui/alert-dialog"

import { seedAuthenticatedImagePreview } from "~/lib/authenticated-image-cache"

import { compressImagesForUpload } from "~/lib/upload-utils"



interface InspectionPhotosSectionProps {

    documentId: number

    hasReport: boolean

    isReadOnly: boolean

}



interface LocalPreview {

    id: string

    file: File

    url: string

}



export function InspectionPhotosSection({

    documentId,

    hasReport,

    isReadOnly,

}: InspectionPhotosSectionProps) {

    const queryClient = useQueryClient()

    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const localPreviewsRef = React.useRef<LocalPreview[]>([])

    const [localPreviews, setLocalPreviews] = React.useState<LocalPreview[]>([])

    const [uploadProgress, setUploadProgress] = React.useState(0)

    const [preview, setPreview] = React.useState<{ id: number; fileName: string } | null>(null)

    const [pendingDeleteId, setPendingDeleteId] = React.useState<number | null>(null)



    const { data: photos = [], isLoading } = useQuery({

        queryKey: ["inspection-report-photos", documentId],

        queryFn: () => DocumentService.getInspectionReportPhotos(documentId),

        enabled: hasReport,

    })



    const updateLocalPreviews = React.useCallback((next: LocalPreview[]) => {

        localPreviewsRef.current = next

        setLocalPreviews(next)

    }, [])



    const invalidatePhotos = () => {

        queryClient.invalidateQueries({ queryKey: ["inspection-report-photos", documentId] })

    }



    const uploadMutation = useMutation({

        mutationFn: async ({

            files,

        }: {

            files: File[]

            previews: LocalPreview[]

        }) => {

            setUploadProgress(0)

            const compressedFiles = await compressImagesForUpload(files)

            return DocumentService.uploadInspectionReportPhotos(

                documentId,

                compressedFiles,

                setUploadProgress,

            )

        },

        onSuccess: (data, variables) => {

            toast.success("Inspection photos uploaded")



            data.attachments.forEach((attachment, index) => {

                const localPreview = variables.previews[index]

                if (localPreview) {

                    seedAuthenticatedImagePreview(attachment.id, localPreview.url)

                }

            })



            const uploadedIds = new Set(variables.previews.map((item) => item.id))

            const remaining = localPreviewsRef.current.filter((item) => {

                if (uploadedIds.has(item.id)) {

                    return false

                }

                return true

            })

            updateLocalPreviews(remaining)



            queryClient.setQueryData<DocumentAttachment[]>(

                ["inspection-report-photos", documentId],

                (current = []) => [...current, ...data.attachments],

            )

            setUploadProgress(0)

            invalidatePhotos()

        },

        onError: (error: any) => {

            setUploadProgress(0)

            toast.error(error?.response?.data?.message || "Failed to upload inspection photos")

        },

    })



    const deleteMutation = useMutation({

        mutationFn: (attachmentId: number) =>

            DocumentService.deleteInspectionReportPhoto(documentId, attachmentId),

        onSuccess: () => {

            toast.success("Inspection photo deleted")

            setPendingDeleteId(null)

            invalidatePhotos()

        },

        onError: (error: any) => {

            toast.error(error?.response?.data?.message || "Failed to delete inspection photo")

        },

    })



    React.useEffect(() => {

        return () => {

            localPreviewsRef.current.forEach((item) => URL.revokeObjectURL(item.url))

        }

    }, [])



    const handleFilesSelected = (fileList: FileList | null) => {

        if (!fileList || fileList.length === 0) return



        const imageFiles = Array.from(fileList).filter((file) =>

            file.type.startsWith("image/")

        )



        if (imageFiles.length === 0) {

            toast.error("Please select image files only (JPEG, PNG, or WebP)")

            return

        }



        const nextPreviews = imageFiles.map((file) => ({

            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,

            file,

            url: URL.createObjectURL(file),

        }))



        updateLocalPreviews([...localPreviewsRef.current, ...nextPreviews])

        uploadMutation.mutate({ files: imageFiles, previews: nextPreviews })

    }



    const canUpload = hasReport && !isReadOnly

    const uploadLabel = uploadMutation.isPending

        ? uploadProgress > 0 && uploadProgress < 100

            ? `Uploading... ${uploadProgress}%`

            : "Preparing..."

        : "Upload Photos"



    return (

        <section className="space-y-3">

            <div className="flex items-center justify-between gap-3 border-b pb-1">

                <h3 className="text-[12px] font-bold uppercase tracking-wide text-zinc-700">

                    Inspection Photos

                </h3>

                {canUpload && (

                    <>

                        <input

                            ref={fileInputRef}

                            type="file"

                            accept="image/jpeg,image/jpg,image/png,image/webp"

                            multiple

                            className="hidden"

                            onChange={(e) => {

                                handleFilesSelected(e.target.files)

                                e.target.value = ""

                            }}

                        />

                        <Button

                            type="button"

                            size="sm"

                            variant="outline"

                            disabled={uploadMutation.isPending}

                            onClick={() => fileInputRef.current?.click()}

                        >

                            {uploadMutation.isPending ? (

                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />

                            ) : (

                                <Upload className="h-4 w-4 mr-1" />

                            )}

                            {uploadLabel}

                        </Button>

                    </>

                )}

            </div>



            {uploadMutation.isPending && (

                <div className="space-y-1">

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">

                        <div

                            className="h-full rounded-full bg-teal-600 transition-[width] duration-200"

                            style={{ width: `${Math.max(uploadProgress, 4)}%` }}

                        />

                    </div>

                    <p className="text-[11px] text-muted-foreground">

                        Compressing and uploading photos in parallel for faster transfer...

                    </p>

                </div>

            )}



            {!hasReport && (

                <p className="text-sm text-muted-foreground">

                    Save a draft of the inspection report before uploading site photographs.

                </p>

            )}



            {hasReport && isLoading && (

                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">

                    <Loader2 className="h-4 w-4 animate-spin" />

                    Loading photos...

                </div>

            )}



            {hasReport && !isLoading && photos.length === 0 && localPreviews.length === 0 && (

                <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">

                    <ImagePlus className="mx-auto h-8 w-8 text-zinc-400 mb-2" />

                    <p className="text-sm text-muted-foreground">

                        {isReadOnly

                            ? "No inspection photos were attached to this report."

                            : "No inspection photos yet. Upload site photographs from the inspection."}

                    </p>

                </div>

            )}



            {(photos.length > 0 || localPreviews.length > 0) && (

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">

                    {photos.map((photo: DocumentAttachment) => (

                        <div

                            key={photo.id}

                            className="group relative overflow-hidden rounded-md border bg-white"

                        >

                            <button

                                type="button"

                                className="block w-full aspect-square bg-zinc-100"

                                onClick={() =>

                                    setPreview({ id: photo.id, fileName: photo.file_name })

                                }

                            >

                                <AuthenticatedImage

                                    attachmentId={photo.id}

                                    alt={photo.file_name}

                                    className="h-full w-full object-cover"

                                />

                            </button>

                            <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-t">

                                <p className="text-[11px] text-zinc-600 truncate" title={photo.file_name}>

                                    {photo.file_name}

                                </p>

                                <div className="flex items-center gap-0.5 shrink-0">

                                    <Button

                                        type="button"

                                        size="icon"

                                        variant="ghost"

                                        className="h-7 w-7"

                                        onClick={() =>

                                            setPreview({ id: photo.id, fileName: photo.file_name })

                                        }

                                    >

                                        <Eye className="h-3.5 w-3.5" />

                                    </Button>

                                    {!isReadOnly && (

                                        <Button

                                            type="button"

                                            size="icon"

                                            variant="ghost"

                                            className="h-7 w-7 text-destructive"

                                            disabled={deleteMutation.isPending}

                                            onClick={() => setPendingDeleteId(photo.id)}

                                        >

                                            <Trash2 className="h-3.5 w-3.5" />

                                        </Button>

                                    )}

                                </div>

                            </div>

                        </div>

                    ))}



                    {localPreviews.map((item) => (

                        <div

                            key={item.id}

                            className="relative overflow-hidden rounded-md border bg-white opacity-80"

                        >

                            <div className="aspect-square bg-zinc-100">

                                <img

                                    src={item.url}

                                    alt={item.file.name}

                                    className="h-full w-full object-cover"

                                />

                            </div>

                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">

                                <Loader2 className="h-5 w-5 animate-spin text-white" />

                            </div>

                            <div className="px-2 py-1.5 border-t">

                                <p className="text-[11px] text-zinc-600 truncate" title={item.file.name}>

                                    {item.file.name}

                                </p>

                            </div>

                        </div>

                    ))}

                </div>

            )}



            {preview && (

                <ImagePreviewModal

                    open={!!preview}

                    onClose={() => setPreview(null)}

                    attachmentId={preview.id}

                    fileName={preview.fileName}

                />

            )}



            <AlertDialog

                open={pendingDeleteId !== null}

                onOpenChange={(open) => {

                    if (!open) setPendingDeleteId(null)

                }}

            >

                <AlertDialogContent>

                    <AlertDialogHeader>

                        <AlertDialogTitle>Delete inspection photo?</AlertDialogTitle>

                        <AlertDialogDescription>

                            This permanently removes the photo from the inspection record.

                        </AlertDialogDescription>

                    </AlertDialogHeader>

                    <AlertDialogFooter>

                        <AlertDialogCancel>Cancel</AlertDialogCancel>

                        <AlertDialogAction

                            onClick={() => {

                                if (pendingDeleteId !== null) {

                                    deleteMutation.mutate(pendingDeleteId)

                                }

                            }}

                        >

                            Delete

                        </AlertDialogAction>

                    </AlertDialogFooter>

                </AlertDialogContent>

            </AlertDialog>

        </section>

    )

}


