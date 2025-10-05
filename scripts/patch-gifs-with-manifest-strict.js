const fs = require('fs')
const path = require('path')

const workspace = path.resolve(__dirname, '..')
const gifsJsonPath = path.join(workspace, 'data', 'gifs.json')
const manifestPath = path.join(workspace, 'data', 'gifs-cache', 'manifest.json')

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function isSteamPng(entry) {
  if (!entry || !entry.status || entry.status !== 'saved') return false
  if (!entry.contentType) return false
  const url = (entry.url || '').toLowerCase()
  const hostOk = url.includes('community.fastly.steamstatic.com') || url.includes('steamcommunity')
  const isPng = entry.contentType === 'image/png' || url.endsWith('.png')
  return hostOk && isPng
}

function indexManifest(manifest) {
  const map = new Map()
  for (const e of manifest) {
    if (!isSteamPng(e)) continue
    const key = (e.name || '').toLowerCase().trim()
    if (!key) continue
    if (!map.has(key)) map.set(key, e)
  }
  return map
}

function walkAndPatch(gifs, manifestMap) {
  let patched = 0
  function patchItem(item) {
    if (!item || typeof item !== 'object') return
    if (item.gif && typeof item.gif === 'string') {
      const key = (item.name || '').toLowerCase().trim()
      if (manifestMap.has(key)) {
        const m = manifestMap.get(key)
        if (m.path) {
          // Use local cache path relative to repo root
          const rel = path.relative(workspace, m.path)
          item.gif = rel.replace(/\\\\/g, '/')
          patched++
        } else if (m.url) {
          item.gif = m.url
          patched++
        }
      }
    }
  }

  // recurse through cases structure to find item objects with name/gif
  for (const caseId of Object.keys(gifs.cases || {})) {
    const caseDef = gifs.cases[caseId]
    const buckets = caseDef.items || {}
    for (const bucket of Object.keys(buckets)) {
      const list = buckets[bucket].items || []
      for (const it of list) patchItem(it)
    }
  }

  return patched
}

function main() {
  if (!fs.existsSync(gifsJsonPath)) {
    console.error('data/gifs.json not found')
    process.exit(1)
  }
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest not found at', manifestPath)
    process.exit(1)
  }

  const gifs = loadJson(gifsJsonPath)
  const manifest = loadJson(manifestPath)
  const manifestMap = indexManifest(manifest)

  console.log('Found', manifestMap.size, 'steam/png entries in manifest')

  const backup = gifsJsonPath + '.strict.bak'
  fs.copyFileSync(gifsJsonPath, backup)
  console.log('Backup written to', backup)

  const patched = walkAndPatch(gifs, manifestMap)
  if (patched === 0) {
    console.log('No items patched (no matching steam/png manifest entries)')
  } else {
    fs.writeFileSync(gifsJsonPath, JSON.stringify(gifs, null, 2), 'utf8')
    console.log('Patched', patched, 'items and wrote updated data/gifs.json')
  }
}

main()
