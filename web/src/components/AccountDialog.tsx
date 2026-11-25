import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { LockKeyhole, LogOut, Mail } from 'lucide-react'
import { auth, authMessage } from '../auth'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

export function AccountDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const title = user
    ? 'Sua conta'
    : mode === 'register'
      ? 'Crie sua estante'
      : mode === 'reset'
        ? 'Recupere sua senha'
        : 'Entre no Paginarium'
  function changeMode(next: typeof mode) {
    setMode(next)
    setError('')
    setNotice('')
    setPassword('')
  }
  async function perform(action: () => Promise<void>) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
    } catch (reason) {
      setError(authMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    const client = auth
    await perform(async () => {
      if (mode === 'reset') {
        await sendPasswordResetEmail(client, email.trim())
        setNotice('Se este e-mail tiver cadastro, você receberá um link para redefinir a senha.')
      } else if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(client, email.trim(), password)
        await sendEmailVerification(credential.user)
        setNotice('Enviamos um link de confirmação para seu e-mail.')
      } else {
        await signInWithEmailAndPassword(client, email.trim(), password)
        onClose()
      }
    })
  }
  const canVerify =
    user?.providerData.some((provider) => provider.providerId === 'password') && !user.emailVerified
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="pg-dialog auth-dialog">
        <DialogHeader>
          <span className="dialog-symbol">
            <LockKeyhole size={22} />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {user ? user.email : 'Guarde suas leituras e acesse a mesma estante em outros aparelhos.'}
          </DialogDescription>
        </DialogHeader>
        {!auth ? (
          <p className="inline-notice">
            A entrada em contas está indisponível nesta instalação. A estante de demonstração está
            disponível para explorar.
          </p>
        ) : user ? (
          <div className="auth-actions">
            {canVerify && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    await sendEmailVerification(user)
                    setNotice('Enviamos um novo link de confirmação.')
                  })
                }
              >
                <Mail /> Reenviar confirmação
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await signOut(auth!)
                  onClose()
                })
              }
            >
              <LogOut /> Sair da conta
            </Button>
          </div>
        ) : (
          <>
            {mode !== 'reset' && (
              <>
                <Button
                  variant="outline"
                  className="google-btn"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      const provider = new GoogleAuthProvider()
                      provider.setCustomParameters({ prompt: 'select_account' })
                      await signInWithPopup(auth!, provider)
                      onClose()
                    })
                  }
                >
                  <span aria-hidden="true" className="google-mark">
                    G
                  </span>{' '}
                  Continuar com Google
                </Button>
                <div className="form-or">ou</div>
              </>
            )}
            <form className="stack-form" onSubmit={submit}>
              <label htmlFor="account-email">
                E-mail
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {mode !== 'reset' && (
                <label htmlFor="account-password">
                  Senha
                  <Input
                    id="account-password"
                    type="password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {mode === 'login' && (
                <button className="text-action" type="button" onClick={() => changeMode('reset')}>
                  Esqueci minha senha
                </button>
              )}
              <Button disabled={busy} type="submit">
                {busy
                  ? 'Aguarde…'
                  : mode === 'login'
                    ? 'Entrar'
                    : mode === 'register'
                      ? 'Criar conta'
                      : 'Enviar link de recuperação'}
              </Button>
            </form>
            <button
              className="text-action"
              type="button"
              onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Criar uma conta' : 'Voltar para entrar'}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="inline-notice">
            {notice}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
