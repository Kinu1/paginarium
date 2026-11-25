import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : null

if (auth && import.meta.env.DEV && import.meta.env.VITE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL, { disableWarnings: true })
}

export function authMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Confira o endereço de e-mail.',
    'auth/invalid-credential': 'Confira o e-mail e a senha e tente novamente.',
    'auth/user-not-found': 'Confira o e-mail e a senha e tente novamente.',
    'auth/wrong-password': 'Confira o e-mail e a senha e tente novamente.',
    'auth/email-already-in-use': 'Este e-mail já tem uma conta. Entre ou recupere a senha.',
    'auth/weak-password': 'Use uma senha com pelo menos seis caracteres.',
    'auth/network-request-failed': 'Confira sua conexão e tente novamente.',
    'auth/too-many-requests': 'Houve muitas tentativas. Tente novamente em alguns minutos.',
    'auth/popup-blocked': 'Permita que o navegador abra a janela do Google e tente novamente.',
    'auth/popup-closed-by-user': 'A entrada com Google foi cancelada.',
    'auth/account-exists-with-different-credential': 'Entre com o método já associado a esse e-mail.',
  }
  return messages[code] ?? 'Não foi possível concluir a ação. Tente novamente.'
}
