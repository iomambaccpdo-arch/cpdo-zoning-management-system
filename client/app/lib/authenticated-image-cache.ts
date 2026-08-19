const previewUrlByAttachmentId = new Map<number, string>()

export function seedAuthenticatedImagePreview(attachmentId: number, previewUrl: string) {
  previewUrlByAttachmentId.set(attachmentId, previewUrl)
}

export function consumeAuthenticatedImagePreview(attachmentId: number): string | null {
  const previewUrl = previewUrlByAttachmentId.get(attachmentId) ?? null
  if (previewUrl) {
    previewUrlByAttachmentId.delete(attachmentId)
  }
  return previewUrl
}
