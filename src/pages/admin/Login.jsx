import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

export const Login = () => {
  const ref = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, session, isAdmin, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useGSAP(() => {
    gsap.from(ref.current, { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out' })
  }, { scope: ref })

  const from = location.state?.from ?? '/admin'

  if (!loading && session && isAdmin) return <Navigate to={from} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-wrapper">
      <form ref={ref} onSubmit={handleSubmit} className="admin-login-card">
        <div className="admin-login-header">
          <div className="logo-mark">VA</div>
          <div className="logo-text">
            <span className="logo-title">Vapers Alcosa</span>
            <span className="logo-sub">Panel de gestión</span>
          </div>
        </div>

        <div className="field-group">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@vapersalcosa.com"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && <p className="admin-login-error">{error}</p>}

        <button type="submit" className="btn-primary admin-login-submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
