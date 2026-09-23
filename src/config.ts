/**
 * Publika Firebase-identifierare för inloggningen (beslut 2, 2026-09-15), ingen hemlighet: de ligger i varje klient.
 * Tomt apiKey betyder att inloggningen inte är på, och appen använder grindkoden som förut.
 * Hämtas ur Firebase Console för projektet flaskor-d3762: Project settings, Your apps, webbappen.
 */
export const FIREBASE = {
  apiKey: 'AIzaSyBHHc0LJN1ofGWesjd0oyXMyHZFtmxux1Q',
  // Egen domän (authhost/, Firebase Hosting) så Googles ruta säger buildapp.se, inte flaskor-d3762.firebaseapp.com.
  authDomain: 'flaskor.buildapp.se',
  projectId: 'flaskor-d3762',
  appId: '1:460125004076:web:1dd87edc54ae279a334c89',
}
