import { ref as dbRef, set, update, remove, onValue } from 'firebase/database'
import { db } from '../firebase'

// Durable write-through outbox.
//
// The Firebase web SDK keeps offline writes only in an in-memory queue for the
// current tab, so a reload/close while offline loses any unsent writes. This
// outbox persists every mutating write to localStorage and replays it to
// Firebase on startup and whenever the connection is (re)established, so no
// observation is lost across reloads. Writes are idempotent (uuid keys +
// set/update/remove), so replay is safe — last write per path wins.

const STORAGE_KEY = 'flowapp_outbox'

const listeners = new Set()
let seqCounter = Date.now()

function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function persist(outbox) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outbox))
  } catch {
    // Storage unavailable or over quota — best effort; the in-memory Firebase
    // queue still covers the in-session case.
  }
  notify()
}

function notify() {
  const count = getPendingCount()
  listeners.forEach((listener) => listener(count))
}

export function getPendingCount() {
  return Object.keys(readOutbox()).length
}

export function subscribePending(listener) {
  listeners.add(listener)
  listener(getPendingCount())
  return () => listeners.delete(listener)
}

// Coalesce to a single pending op per path. An `update` on top of a pending
// set/update merges its fields; anything else replaces. Each op gets a fresh
// sequence number so a stale ack can't clear a newer pending write.
function enqueue(path, type, value) {
  const outbox = readOutbox()
  const seq = ++seqCounter
  if (type === 'remove') {
    outbox[path] = { type: 'remove', seq }
  } else {
    const existing = outbox[path]
    if (existing && existing.type !== 'remove' && type === 'update') {
      outbox[path] = { type: existing.type, value: { ...existing.value, ...value }, seq }
    } else {
      outbox[path] = { type, value, seq }
    }
  }
  persist(outbox)
  return seq
}

function clearIfUnchanged(path, seq) {
  const outbox = readOutbox()
  if (outbox[path] && outbox[path].seq === seq) {
    delete outbox[path]
    persist(outbox)
  }
}

function fbOp(type, path, value) {
  const node = dbRef(db, path)
  if (type === 'set') return set(node, value)
  if (type === 'update') return update(node, value)
  if (type === 'remove') return remove(node)
  return Promise.reject(new Error(`Unknown outbox op: ${type}`))
}

// Issue a write that is durable across reloads. Records the op in the outbox,
// then fires the Firebase op (which updates the local cache optimistically, so
// onValue subscribers see it immediately). The outbox entry is cleared once the
// server acks; until then it survives reloads and is replayed on reconnect.
// Not awaited by callers on hot paths, so recording stays instant offline.
export function writeThrough(type, path, value) {
  const seq = enqueue(path, type, value)
  return fbOp(type, path, value)
    .then(() => clearIfUnchanged(path, seq))
    .catch((error) => {
      // Stays queued for replay. Surface for visibility.
      console.warn('[offlineQueue] write deferred:', path, error?.message || error)
    })
}

export function replayOutbox() {
  const outbox = readOutbox()
  Object.entries(outbox).forEach(([path, op]) => {
    fbOp(op.type, path, op.value)
      .then(() => clearIfUnchanged(path, op.seq))
      .catch(() => {})
  })
}

let autoReplayStarted = false

// Replay the outbox whenever the Realtime DB connection is (re)established.
// The initial `connected → true` event also drives the first replay on startup.
export function startOutboxAutoReplay() {
  if (autoReplayStarted) return
  autoReplayStarted = true
  onValue(dbRef(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
      replayOutbox()
    }
  })
}
