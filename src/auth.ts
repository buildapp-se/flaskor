import { FIREBASE } from './config.ts'

/**
 * Firebase Auth laddad från Googles CDN vid behov, som i Beefcake, Grammat och Sipdeck. Inget npm-beroende:
 * SDK:n är stor och byts sällan. Typerna nedan täcker exakt det vi anropar.
 */
export interface AuthUser {
  uid: string
  email: string | null
  emailVerified: boolean
}

interface FirebaseUser extends AuthUser {
  getIdToken(forceRefresh?: boolean): Promise<string>
  reload(): Promise<void>
}
interface FirebaseApp {
  readonly name: string
}
interface Auth {
  currentUser: FirebaseUser | null
}
interface AppModule {
  initializeApp(config: typeof FIREBASE): FirebaseApp
}
interface AuthModule {
  getAuth(app: FirebaseApp): Auth
  onAuthStateChanged(auth: Auth, next: (user: FirebaseUser | null) => void): () => void
  GoogleAuthProvider: new () => unknown
  signInWithPopup(auth: Auth, provider: unknown): Promise<unknown>
  signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<unknown>
  createUserWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<unknown>
  sendEmailVerification(user: FirebaseUser): Promise<void>
  sendPasswordResetEmail(auth: Auth, email: string): Promise<void>
  signOut(auth: Auth): Promise<void>
  deleteUser(user: FirebaseUser): Promise<void>
}

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1'
let loading: Promise<{ auth: Auth; mod: AuthModule }> | null = null

export function isAuthConfigured(): boolean {
  return FIREBASE.apiKey.length > 0
}

function firebase(): Promise<{ auth: Auth; mod: AuthModule }> {
  if (!isAuthConfigured()) return Promise.reject(new Error('Inloggningen är inte konfigurerad.'))
  loading ??= (async () => {
    const [app, mod] = await Promise.all([
      import(/* @vite-ignore */ `${SDK}/firebase-app.js`) as Promise<AppModule>,
      import(/* @vite-ignore */ `${SDK}/firebase-auth.js`) as Promise<AuthModule>,
    ])
    return { auth: mod.getAuth(app.initializeApp(FIREBASE)), mod }
  })()
  return loading
}

export function subscribeToAuth(next: (user: AuthUser | null) => void): () => void {
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  firebase()
    .then(({ auth, mod }) => {
      if (!cancelled) unsubscribe = mod.onAuthStateChanged(auth, next)
    })
    .catch((err: unknown) => {
      console.error('Firebase kunde inte laddas:', err)
      next(null)
    })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export async function getIdToken(): Promise<string> {
  const { auth } = await firebase()
  if (!auth.currentUser) throw new Error('Du är inte inloggad.')
  return auth.currentUser.getIdToken()
}

export async function signInWithGoogle(): Promise<void> {
  const { auth, mod } = await firebase()
  await mod.signInWithPopup(auth, new mod.GoogleAuthProvider())
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { auth, mod } = await firebase()
  await mod.signInWithEmailAndPassword(auth, email, password)
}

/** Nytt konto med e-post: Firebase skickar bekräftelsemejlet, Workern släpper bara in bekräftade adresser. */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  const { auth, mod } = await firebase()
  await mod.createUserWithEmailAndPassword(auth, email, password)
  if (auth.currentUser) await mod.sendEmailVerification(auth.currentUser)
}

export async function resendVerification(): Promise<void> {
  const { auth, mod } = await firebase()
  if (auth.currentUser) await mod.sendEmailVerification(auth.currentUser)
}

/** Läser om användaren, till exempel efter att bekräftelselänken klickats i en annan flik. Tvingar fram en ny token med flaggan satt. */
export async function refreshUser(): Promise<AuthUser | null> {
  const { auth } = await firebase()
  await auth.currentUser?.reload()
  await auth.currentUser?.getIdToken(true)
  return auth.currentUser
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { auth, mod } = await firebase()
  await mod.sendPasswordResetEmail(auth, email)
}

export async function signOutUser(): Promise<void> {
  const { auth, mod } = await firebase()
  await mod.signOut(auth)
}

/** Tar bort Firebase-kontot. Kastar auth/requires-recent-login om inloggningen är gammal; då loggas man in igen och försöker på nytt. */
export async function deleteFirebaseUser(): Promise<void> {
  const { auth, mod } = await firebase()
  if (auth.currentUser) await mod.deleteUser(auth.currentUser)
}

/** Firebase-felkoder till svenska. Okända koder visas som de är, det är bättre än att gissa. */
export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Ogiltig e-postadress.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Fel e-post eller lösenord.'
    case 'auth/email-already-in-use':
      return 'Adressen har redan ett konto. Logga in i stället.'
    case 'auth/weak-password':
      return 'Lösenordet måste vara minst 6 tecken.'
    case 'auth/too-many-requests':
      return 'För många försök. Vänta en stund.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Inloggningen avbröts.'
    case 'auth/popup-blocked':
      return 'Webbläsaren blockerade inloggningsfönstret.'
    case 'auth/network-request-failed':
      return 'Ingen kontakt med inloggningen. Kontrollera nätet.'
    case 'auth/requires-recent-login':
      return 'Logga ut och in igen, och försök sedan på nytt.'
    default:
      return code ? `Inloggningen misslyckades (${code}).` : 'Inloggningen misslyckades.'
  }
}
