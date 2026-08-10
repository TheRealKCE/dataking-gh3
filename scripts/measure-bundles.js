/**
 * Per-route First Load JS, measured from the last `next build`.
 * Run with: node scripts/measure-bundles.js [--top N] [--json out.json]
 *
 * `next build` prints this table once and throws it away, which makes "did that
 * change help?" unanswerable after the fact. This reads the same manifests the
 * build wrote, so it can be re-run against any build without rebuilding, and its
 * JSON output diffs cleanly between branches.
 *
 * Sizes are gzipped, because transfer size is what a 2G connection actually pays.
 * Raw parse size is reported alongside it: on a low-end CPU, parse time tracks the
 * raw number, not the compressed one, and both matter for different reasons.
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const NEXT_DIR = path.join(__dirname, '..', '.next')

function parseArgs() {
    const args = process.argv.slice(2)
    const out = { top: 25, json: null }
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--top') out.top = Number(args[++i]) || 25
        else if (args[i] === '--json') out.json = args[++i]
    }
    return out
}

const sizeCache = new Map()

/** Returns { raw, gz } in bytes for one build asset, or zeros if it vanished. */
function measure(file) {
    if (sizeCache.has(file)) return sizeCache.get(file)
    const full = path.join(NEXT_DIR, file)
    let result = { raw: 0, gz: 0 }
    try {
        const buf = fs.readFileSync(full)
        result = { raw: buf.length, gz: zlib.gzipSync(buf, { level: 9 }).length }
    } catch {
        // A manifest entry with no file on disk is not fatal — report it as zero
        // rather than aborting a measurement run over one stale reference.
    }
    sizeCache.set(file, result)
    return result
}

function kb(bytes) {
    return (bytes / 1024).toFixed(1)
}

function main() {
    const { top, json } = parseArgs()

    const manifestPath = path.join(NEXT_DIR, 'app-build-manifest.json')
    if (!fs.existsSync(manifestPath)) {
        console.error('No .next/app-build-manifest.json — run `npm run build` first.')
        process.exit(1)
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    const routes = Object.entries(manifest.pages).map(([route, files]) => {
        // Dedupe: shared chunks appear in many routes but are downloaded once.
        // Within a single route's first load they still only count once.
        const unique = [...new Set(files)]
        let raw = 0
        let gz = 0
        for (const f of unique) {
            const m = measure(f)
            raw += m.raw
            gz += m.gz
        }
        return { route, chunks: unique.length, raw, gz }
    })

    routes.sort((a, b) => b.gz - a.gz)

    // The chunk set shared by every route — the floor no route can get under.
    const shared = routes.length
        ? routes.map((r) => new Set(manifest.pages[r.route])).reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))))
        : new Set()
    let sharedRaw = 0
    let sharedGz = 0
    for (const f of shared) {
        const m = measure(f)
        sharedRaw += m.raw
        sharedGz += m.gz
    }

    console.log(`\nRoutes measured: ${routes.length}`)
    console.log(`Shared by all routes: ${kb(sharedGz)} KB gz  (${kb(sharedRaw)} KB raw, ${shared.size} chunks)\n`)
    console.log(`Heaviest ${Math.min(top, routes.length)} routes by First Load JS (gzipped):\n`)
    console.log('   GZ KB     RAW KB   CHUNKS  ROUTE')
    console.log('  ' + '-'.repeat(76))
    for (const r of routes.slice(0, top)) {
        console.log(
            `  ${kb(r.gz).padStart(7)}  ${kb(r.raw).padStart(9)}  ${String(r.chunks).padStart(6)}  ${r.route}`
        )
    }

    const totalUnique = [...sizeCache.entries()].reduce(
        (acc, [, v]) => ({ raw: acc.raw + v.raw, gz: acc.gz + v.gz }),
        { raw: 0, gz: 0 }
    )
    console.log(`\nAll unique client chunks: ${kb(totalUnique.gz)} KB gz (${kb(totalUnique.raw)} KB raw)\n`)

    if (json) {
        fs.writeFileSync(
            json,
            JSON.stringify({ generatedAt: new Date().toISOString(), sharedGz, sharedRaw, routes }, null, 2)
        )
        console.log(`Wrote ${json}\n`)
    }
}

main()
