const fs = require('fs')
const path = require('path')

const CACHE_DIR = path.join(__dirname, '..', 'data', 'gifs-cache')
const MANIFEST = path.join(CACHE_DIR, 'manifest.json')

function backupFile(filePath) {
  const bak = filePath + '.bak.' + Date.now()
  fs.copyFileSync(filePath, bak)
  console.log('Backed up', filePath, '->', bak)
  return bak
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('manifest.json not found at', MANIFEST)
    process.exitCode = 1
    return
  }

  // Backup manifest
  backupFile(MANIFEST)

  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))

  // Find png entries
  const pngEntries = manifest.filter(e => (e.path && e.path.toLowerCase().endsWith('.png')) || (e.contentType && e.contentType === 'image/png'))
  console.log('Found', pngEntries.length, 'PNG entries in manifest')

  // Backup PNG list
  const pngListPath = path.join(CACHE_DIR, 'pngs-to-delete.' + Date.now() + '.json')
  fs.writeFileSync(pngListPath, JSON.stringify(pngEntries, null, 2))
  console.log('Wrote list of png entries to', pngListPath)

  // Delete png files
  let deletedFiles = 0
  for (const e of pngEntries) {
    if (!e.path) continue
    const absolute = path.join(__dirname, '..', e.path)
    try {
      if (fs.existsSync(absolute)) {
        fs.unlinkSync(absolute)
        deletedFiles++
        console.log('Deleted', absolute)
      }
    } catch (err) {
      console.warn('Failed to delete', absolute, err && err.message)
    }
  }

  // Filter manifest to remove png entries
  const newManifest = manifest.filter(e => !((e.path && e.path.toLowerCase().endsWith('.png')) || (e.contentType && e.contentType === 'image/png')))
  fs.writeFileSync(MANIFEST, JSON.stringify(newManifest, null, 2))
  console.log('Wrote updated manifest.json, removed', manifest.length - newManifest.length, 'entries')
  console.log('Deleted files count:', deletedFiles)
}

if (require.main === module) main()
