import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationErrors = {}

    if (!email.trim()) {
      validationErrors.email = 'Email is required.'
    }

    if (!password.trim()) {
      validationErrors.password = 'Password is required.'
    }

    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setServerError('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setServerError(data.message || 'Login failed. Please check your details and try again.')
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem(
        'user',
        JSON.stringify({
          user_id: data.user.user_id,
          fname: data.user.fname,
          lname: data.user.lname,
          email: data.user.email,
          roles: Array.isArray(data.user.roles) ? data.user.roles : [],
        }),
      )
      navigate('/dashboard')
    } catch {
      setServerError('Unable to connect to the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-brand-panel" aria-label="SME Wallet">
          <div className="contour contour-one" aria-hidden="true" />
          <div className="contour contour-two" aria-hidden="true" />
          <div className="contour contour-three" aria-hidden="true" />
          <div className="brand-copy">
            <p className="brand-wordmark">SME WALLET</p>
            <p className="brand-tagline">Simple. Secure. Built for your business.</p>
          </div>
        </aside>

        <section className="login-card" aria-labelledby="login-heading">
          <div className="login-header">
            <p className="login-brand">SME WALLET</p>
            <h1 id="login-heading">Welcome Back</h1>
            <p>Sign in to manage your wallet.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setServerError('')
                }}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                autoComplete="email"
              />
              {errors.email && (
                <p id="email-error" className="form-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setServerError('')
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                autoComplete="current-password"
              />
              {errors.password && (
                <p id="password-error" className="form-error">
                  {errors.password}
                </p>
              )}
            </div>

            <a className="forgot-password" href="#forgot-password">
              Forgot Password?
            </a>

            {serverError && <p className="form-error">{serverError}</p>}

            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="register-prompt">
            Don&apos;t have an account?{' '}
            <Link to="/register">Register</Link>
          </p>
        </section>
      </div>
    </main>
  )
}

export default Login
