/**
 * Patches whatsapp-web.js to fix media sends failing with:
 *   "Data passed to getter must include an id property (it's how we memoize) but got undefined"
 *
 * Root cause (wwebjs/whatsapp-web.js#201922, fixed upstream but unreleased in #201923):
 * In src/util/Injected/Utils.js, window.WWebJS.sendMessage builds the outgoing
 * message object, then spreads the media model returned by processMediaData()
 * into it. That model carries an enumerable private `__x_id` field which
 * overwrites the correctly-set `id` on the plain object, so WhatsApp Web's own
 * Msg.initialize() later receives id: undefined and throws.
 *
 * Fix: delete the stray __x_id right after the message object is built, before
 * it's used. This only ever affects media sends (text messages don't carry
 * __x_id), so nothing else changes.
 *
 * Safe to run on every `npm install` — it no-ops if already patched, and
 * throws loudly (rather than silently skipping) if whatsapp-web.js's internals
 * have changed shape, so a future library update can't silently un-fix this.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const targetFile = join(
  __dirname,
  '..',
  'node_modules',
  'whatsapp-web.js',
  'src',
  'util',
  'Injected',
  'Utils.js'
)

function applyPatch() {
  if (!existsSync(targetFile)) {
    console.warn('[patch-wwebjs-media-id] whatsapp-web.js not found at expected path, skipping:', targetFile)
    return
  }

  const original = readFileSync(targetFile, 'utf8')

  if (original.includes('delete message.__x_id')) {
    console.log('[patch-wwebjs-media-id] Already patched — nothing to do.')
    return
  }

  // Anchor on the unique comment that immediately follows the message object
  // construction in window.WWebJS.sendMessage (confirmed present in 1.34.7).
  const anchor = "// Bot's won't reply if canonicalUrl is set (linking)"

  if (!original.includes(anchor)) {
    throw new Error(
      '[patch-wwebjs-media-id] Could not find the expected anchor comment in Utils.js. ' +
      'whatsapp-web.js internals may have changed (or the bug may already be fixed upstream) — check manually before proceeding. ' +
      'Target file: ' + targetFile
    )
  }

  const patchLine =
    '        // patch(wwebjs-media-id): strip stale media-model id that breaks Msg.initialize\n' +
    '        // see https://github.com/wwebjs/whatsapp-web.js/issues/201922\n' +
    '        delete message.__x_id;\n\n        '

  const patched = original.replace(anchor, patchLine + anchor)

  writeFileSync(targetFile, patched, 'utf8')
  console.log('[patch-wwebjs-media-id] Patch applied successfully to', targetFile)
}

try {
  applyPatch()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}