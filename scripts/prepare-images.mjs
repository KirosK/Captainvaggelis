// Copies the curated photos into public/media, resized and re-encoded, and writes
// src/data/media.generated.json with dimensions and alt texts.
// It also writes the 1200×630 share images (public/media/og/<property>.jpg), cropped from each hero at its focus point.
// Input: ../research/curation.json (see research/README for the format).
// `node scripts/prepare-images.mjs --og-only` only (re)writes the share images.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(SITE, '..')
const curation = JSON.parse(await fs.readFile(path.join(ROOT, 'research/curation.json'), 'utf8'))
const OUT = path.join(SITE, 'public/media')
const reviewAlts = JSON.parse(await fs.readFile(path.join(ROOT, 'research/review_alts.json'), 'utf8').catch(() => '{}'))
const MAX_W = 1600
const OG = { width: 1200, height: 630 }
const ogOnly = process.argv.includes('--og-only')

const done = new Map()

function sourcePath(file) {
  // property photos live at ROOT/<folder>/<n>.jpg, cruise photos at ROOT/research/cruise-img/...
  return file.startsWith('cruise-img/') ? path.join(ROOT, 'research', file) : path.join(ROOT, file)
}

function slugFor(file, prefix) {
  const base = path.basename(file).replace(/\.[a-z]+$/i, '')
  const folder = path.basename(path.dirname(file))
  return `${prefix}-${folder}-${base}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
}

async function photo(file, prefix, altEn, focus) {
  const key = `${prefix}|${file}`
  if (done.has(key)) return { ...done.get(key), altEn: altEn ?? done.get(key).altEn }
  const src = sourcePath(file)
  const name = slugFor(file, prefix)
  const dir = path.join(OUT, prefix)
  await fs.mkdir(dir, { recursive: true })
  const outFile = path.join(dir, `${name}.jpg`)
  const img = sharp(src).rotate()
  const meta = await img.metadata()
  const width = Math.min(meta.width ?? MAX_W, MAX_W)
  const info = await img
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(outFile)
  const result = { src: `/media/${prefix}/${name}.jpg`, width: info.width, height: info.height, altEn: altEn ?? '', ...(focus ? { focus } : {}) }
  done.set(key, result)
  return result
}

/** 1200×630 crop of a photo around its focus point ("50% 45%"), the size link previews expect. */
async function ogCrop(file, focus, outName) {
  const img = sharp(sourcePath(file)).rotate()
  const { width: w, height: h } = await img.metadata()
  const [fx, fy] = (focus ?? '50% 50%').split(/\s+/).map((v) => parseFloat(v) / 100)
  const ratio = OG.width / OG.height
  // the largest box of the right shape, centred on the focus point and kept inside the photo
  const cw = Math.min(w, Math.round(h * ratio))
  const ch = Math.min(h, Math.round(w / ratio))
  const left = Math.round(Math.min(Math.max(fx * w - cw / 2, 0), w - cw))
  const top = Math.round(Math.min(Math.max(fy * h - ch / 2, 0), h - ch))
  await fs.mkdir(path.join(OUT, 'og'), { recursive: true })
  await img
    .extract({ left, top, width: cw, height: ch })
    .resize(OG.width, OG.height, { kernel: 'lanczos3' })
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUT, 'og', `${outName}.jpg`))
}

for (const prop of ['aegealis', 'theodora']) await ogCrop(curation[prop].hero[0], curation[prop].heroFocus, prop)
if (ogOnly) {
  console.log('Prepared the share images')
  process.exit(0)
}

const media = {}

for (const prop of ['aegealis', 'theodora']) {
  const c = curation[prop]
  const altOf = { ...reviewAlts, ...Object.fromEntries((c.gallery ?? []).map((g) => [g.file, g.altEn])) }
  const heroFile = c.hero[0]
  media[prop] = {
    hero: await photo(heroFile, prop, altOf[heroFile] ?? c.heroAlt ?? '', c.heroFocus),
    gallery: [],
    units: {},
    extras: {},
    ...(c.video ? { video: c.video } : {}),
  }
  for (const [k, f] of Object.entries(c.extras ?? {})) media[prop].extras[k] = await photo(f, prop, altOf[f])
  for (const g of c.gallery) media[prop].gallery.push({ ...(await photo(g.file, prop, g.altEn)), section: g.section })
  for (const [unitKey, files] of Object.entries(c.units ?? {})) {
    media[prop].units[unitKey] = []
    for (const f of files) media[prop].units[unitKey].push(await photo(f, prop, altOf[f]))
  }
}

const cr = curation.cruises
const altOf = { ...reviewAlts, ...Object.fromEntries((cr.gallery ?? []).map((g) => [g.file, g.altEn])) }
media.cruises = { groups: {}, hero: null }
if (cr.hero?.length) media.cruises.hero = await photo(cr.hero[0], 'cruises', altOf[cr.hero[0]] ?? '')
for (const g of cr.groups ?? []) {
  media.cruises.groups[g.key] = {
    cover: await photo(g.cover, 'cruises', altOf[g.cover] ?? ''),
    photos: [],
  }
  for (const f of g.files) media.cruises.groups[g.key].photos.push(await photo(f, 'cruises', altOf[f] ?? ''))
}

await fs.writeFile(path.join(SITE, 'src/data/media.generated.json'), JSON.stringify(media, null, 1))
console.log(`Prepared ${done.size} images`)
