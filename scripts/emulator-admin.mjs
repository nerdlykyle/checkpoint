import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/index.js', import.meta.url))
export function emulatorAdmin() {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Tests require a local Firestore emulator; production writes are forbidden.')
  const { initializeApp, getApps } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  const app = getApps().find(app => app.name === 'membership-tests') || initializeApp({ projectId: 'demo-checkpoint' }, 'membership-tests')
  return getFirestore(app)
}
