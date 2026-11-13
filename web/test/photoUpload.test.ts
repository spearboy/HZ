import assert from 'node:assert/strict'
import { processPhotoUploads, uploadTogether, type PhotoUpload, type PhotoUploadStore } from '../src/photoUpload.ts'

const items: PhotoUpload[] = ['a', 'b', 'c'].map(id => ({ id, file: {} as File }))
const saved = new Set<string>()
const cleaned: string[] = []
let failB = true
const store: PhotoUploadStore = {
  exists: async id => saved.has(id),
  save: async item => {
    if (item.id === 'b' && failB) throw new Error('upload failed')
    saved.add(item.id)
    if (item.id === 'c') throw new Error('response lost after commit')
  },
  clean: async item => { cleaned.push(item.id) },
}
const failed = await processPhotoUploads(items, store)
assert.deepEqual(failed.map(item => item.id), ['b'])
assert.deepEqual([...saved], ['a', 'c'])
assert.deepEqual(cleaned, ['b'])
failB = false
assert.deepEqual(await processPhotoUploads(failed, store), [])
assert.deepEqual([...saved], ['a', 'c', 'b'])

const unreachable: PhotoUploadStore = {
  exists: async () => { throw new Error('network unavailable') },
  save: async () => { throw new Error('unexpected save') },
  clean: async () => { throw new Error('unexpected cleanup') },
}
assert.deepEqual(await processPhotoUploads(items.map(item => ({ ...item, attempted: true })), unreachable), items.map(item => ({ ...item, attempted: true })))

let finishSecond!: () => void
let settled = false
const second = new Promise<void>(resolve => { finishSecond = resolve })
const parallel = uploadTogether([
  async () => { throw new Error('first failed') },
  async () => second,
]).finally(() => { settled = true })
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(settled, false, 'cleanup must wait for the other upload')
finishSecond()
await assert.rejects(parallel, /first failed/)
assert.equal(settled, true)
console.log('photo upload retry ok')
