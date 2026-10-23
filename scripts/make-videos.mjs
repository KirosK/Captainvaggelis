// Builds the hero films from still photos: a slow Ken Burns move on every image and soft
// cross-dissolves between them. Input: ../research/videos.json
//   { "<name>": { "files": ["aegalis/2.jpg", ...], "seconds": 5, "fade": 1.2 } }
// Output, in public/media/video:
//   <name>.mp4 + <name>.webm  landscape 1280×720 for tablets and desktops
//   <name>-sm.mp4             portrait 720×1280 for phones (served with media="(max-width: 767px)"), cropped from
//                             each photo around its focus point, so a phone never shows a blown-up strip of the wide film
//   <name>-poster.jpg
// and updates src/data/videos.generated.json.
// `node scripts/make-videos.mjs home` rebuilds one film; add `--mobile` to rebuild only the phone versions.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(SITE, '..')
const OUT = path.join(SITE, 'public/media/video')
const DESKTOP = { w: 1280, h: 720, crf: 25, webmCrf: 37 }
// The phone film is portrait. The photos are about 1024×683, so a 9:16 crop holds about 384×683 source pixels:
// 720×1280 keeps every one of them without inventing detail that is not in the photos.
const MOBILE = { w: 720, h: 1280, crf: 23, maxrate: '700k', bufsize: '1400k' }
const UP = 1.75 // zoompan works on an upscaled frame so slow moves stay smooth
const FPS = 30

const spec = JSON.parse(await fs.readFile(path.join(ROOT, 'research/videos.json'), 'utf8'))
const args = process.argv.slice(2)
const only = args.find((a) => !a.startsWith('--'))
const mobileOnly = args.includes('--mobile')
await fs.mkdir(OUT, { recursive: true })

const src = (f) => (f.startsWith('cruise-img/') ? path.join(ROOT, 'research', f) : path.join(ROOT, f))

// Focus points ("50% 45%") come from media.generated.json, keyed by the published file name that
// scripts/prepare-images.mjs gives each photo.
const media = JSON.parse(await fs.readFile(path.join(SITE, 'src/data/media.generated.json'), 'utf8'))
const focusBySrc = {}
;(function walk(o) {
  if (Array.isArray(o)) o.forEach(walk)
  else if (o && typeof o === 'object') {
    if (o.src && o.focus) focusBySrc[o.src] = o.focus
    Object.values(o).forEach(walk)
  }
})(media)
function publishedSrc(file) {
  const prefix = file.startsWith('cruise-img/') ? 'cruises' : file.startsWith('theodora/') ? 'theodora' : 'aegealis'
  const base = path.basename(file).replace(/\.[a-z]+$/i, '')
  const folder = path.basename(path.dirname(file))
  return `/media/${prefix}/${`${prefix}-${folder}-${base}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.jpg`
}

/** The largest 9:16 box in a photo: around its focus point when it has one, otherwise where sharp sees the subject. */
async function portraitBox(file) {
  const { width: w, height: h } = await sharp(src(file)).metadata()
  const ratio = MOBILE.w / MOBILE.h
  const cw = Math.min(w, Math.round(h * ratio))
  const ch = Math.min(h, Math.round(w / ratio))
  const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max))
  const focus = focusBySrc[publishedSrc(file)]
  if (focus) {
    const [fx, fy] = focus.split(/\s+/).map((v) => parseFloat(v) / 100)
    return { cw, ch, x: clamp(fx * w - cw / 2, w - cw), y: clamp(fy * h - ch / 2, h - ch) }
  }
  const { info } = await sharp(src(file)).resize(cw, ch, { fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true })
  return { cw, ch, x: clamp(Math.abs(info.cropOffsetLeft ?? (w - cw) / 2), w - cw), y: clamp(Math.abs(info.cropOffsetTop ?? (h - ch) / 2), h - ch) }
}

function run(ffArgs) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...ffArgs], { stdio: ['ignore', 'inherit', 'inherit'] })
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
  })
}

// Four gentle camera moves, cycled so consecutive shots never repeat the same motion.
function move(i, frames) {
  const t = `(on/${frames})`
  const ease = `(0.5-0.5*cos(PI*${t}))`
  switch (i % 4) {
    case 0: // slow push in, centred
      return { z: `1.0+0.09*${ease}`, x: `iw/2-(iw/zoom/2)`, y: `ih/2-(ih/zoom/2)` }
    case 1: // drift left to right at a light zoom
      return { z: `1.08`, x: `(iw-iw/zoom)*${ease}`, y: `ih/2-(ih/zoom/2)` }
    case 2: // pull back
      return { z: `1.09-0.09*${ease}`, x: `iw/2-(iw/zoom/2)`, y: `ih/2-(ih/zoom/2)` }
    default: // drift right to left, slightly rising
      return { z: `1.08`, x: `(iw-iw/zoom)*(1-${ease})`, y: `(ih-ih/zoom)*(0.6-0.2*${ease})` }
  }
}

/** The filter graph of one film at one size; `boxes` (portrait) crops each photo before the move. */
function graph(cfg, { w, h }, boxes) {
  const seconds = cfg.seconds ?? 5
  const fade = cfg.fade ?? 1.2
  const frames = Math.round(seconds * FPS)
  const filters = cfg.files.map((f, i) => {
    const mv = move(i, frames)
    const frame = boxes
      ? `crop=${boxes[i].cw}:${boxes[i].ch}:${boxes[i].x}:${boxes[i].y},scale=${w * UP}:${h * UP}:flags=lanczos`
      : // upscale first so the zoompan crop stays smooth, then cover-crop to the frame
        `scale=${w * UP}:${h * UP}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w * UP}:${h * UP}`
    return `[${i}:v]${frame},zoompan=z='${mv.z}':x='${mv.x}':y='${mv.y}':d=${frames}:s=${w}x${h}:fps=${FPS},eq=saturation=1.06:contrast=1.03,setsar=1,format=yuv420p[v${i}]`
  })
  let last = 'v0'
  let offset = seconds - fade
  for (let i = 1; i < cfg.files.length; i++) {
    const out = `x${i}`
    filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[${out}]`)
    last = out
    offset += seconds - fade
  }
  // fade in from and out to the hero's dark overlay so the loop point is invisible
  const total = cfg.files.length * seconds - (cfg.files.length - 1) * fade
  filters.push(`[${last}]fade=t=in:st=0:d=0.8,fade=t=out:st=${(total - 0.9).toFixed(2)}:d=0.9[out]`)
  return { filters: filters.join(';'), total }
}

const manifestPath = path.join(SITE, 'src/data/videos.generated.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '{}'))
const mb = async (f) => `${((await fs.stat(f)).size / 1e6).toFixed(2)} MB`

for (const [name, cfg] of Object.entries(spec)) {
  if (only && name !== only) continue
  const inputs = cfg.files.flatMap((f) => ['-i', src(f)])
  const mp4 = path.join(OUT, `${name}.mp4`)
  const webm = path.join(OUT, `${name}.webm`)
  const small = path.join(OUT, `${name}-sm.mp4`)
  const poster = path.join(OUT, `${name}-poster.jpg`)

  const wide = graph(cfg, DESKTOP)
  console.log(`▶ ${name}: ${cfg.files.length} shots, ${wide.total.toFixed(1)} s`)
  if (!mobileOnly) {
    await run([...inputs, '-filter_complex', wide.filters, '-map', '[out]', '-t', wide.total.toFixed(2), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(DESKTOP.crf), '-tune', 'film', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4])
    await run(['-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(DESKTOP.webmCrf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', webm])
    await run(['-ss', '1.2', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster])
    console.log(`  mp4 ${await mb(mp4)} · webm ${await mb(webm)}`)
  }

  const boxes = await Promise.all(cfg.files.map(portraitBox))
  const tall = graph(cfg, MOBILE, boxes)
  await run([...inputs, '-filter_complex', tall.filters, '-map', '[out]', '-t', tall.total.toFixed(2), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(MOBILE.crf), '-maxrate', MOBILE.maxrate, '-bufsize', MOBILE.bufsize, '-tune', 'film', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', small])
  console.log(`  phone (720×1280) ${await mb(small)}`)

  manifest[name] = { mp4: `/media/video/${name}.mp4`, webm: `/media/video/${name}.webm`, mp4Small: `/media/video/${name}-sm.mp4`, poster: `/media/video/${name}-poster.jpg`, duration: Number(wide.total.toFixed(1)) }
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 1))
console.log('done')
