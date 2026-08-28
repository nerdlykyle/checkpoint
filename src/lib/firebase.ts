import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const database = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null

export function watchAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null)
    return () => undefined
  }
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase is not configured')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}

export async function signOut() {
  if (auth) await firebaseSignOut(auth)
}

let calendarToken: { value: string; expiresAt: number } | null = null

export async function getGoogleCalendarAccessToken() {
  if (!auth?.currentUser) throw new Error('Sign in before connecting Google Calendar.')
  if (calendarToken && calendarToken.expiresAt > Date.now()) return calendarToken.value

  const provider = new GoogleAuthProvider()
  provider.addScope('https://www.googleapis.com/auth/calendar.events')
  provider.setCustomParameters({
    login_hint: auth.currentUser.email || '',
  })
  const result = await reauthenticateWithPopup(auth.currentUser, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (!credential?.accessToken) throw new Error('Google Calendar permission was not granted.')
  calendarToken = { value: credential.accessToken, expiresAt: Date.now() + 50 * 60 * 1000 }
  return calendarToken.value
}
