export type PhotoUpload = { file: File; id: string; attempted?: boolean }

export type PhotoUploadStore = {
  exists: (id: string) => Promise<boolean>
  save: (item: PhotoUpload) => Promise<void>
  clean: (item: PhotoUpload) => Promise<void>
}

// 실패한 항목만 반환하고, 응답이 유실된 저장은 ID로 확인해 중복을 막는다.
export async function processPhotoUploads(items: PhotoUpload[], store: PhotoUploadStore): Promise<PhotoUpload[]> {
  const failed: PhotoUpload[] = []
  for (const item of items) {
    try {
      if (!item.attempted || !await store.exists(item.id)) await store.save(item)
    } catch {
      try {
        if (await store.exists(item.id)) continue
        await store.clean(item)
      } catch { /* 확인이나 정리에 실패해도 다음 파일을 처리한다 */ }
      failed.push({ ...item, attempted: true })
    }
  }
  return failed
}
