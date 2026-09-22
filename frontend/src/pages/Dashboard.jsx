import { useEffect, useState } from 'react'
import './Dashboard.css'

function Dashboard() {
  const [token] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem('token') || ''
  })
  const [balance, setBalance] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [error, setError] = useState(token ? '' : 'Unable to load balance.')

  const getStoredUser = () => {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const rawUser = window.localStorage.getItem('user')
      return rawUser ? JSON.parse(rawUser) : null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!token) {
      return undefined
    }

    const controller = new AbortController()

    const fetchWallet = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch('http://localhost:5000/api/wallet', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to load balance.')
        }

        const nextBalance = Number(data?.wallet?.balance)

        if (!Number.isFinite(nextBalance)) {
          throw new Error('Unable to load balance.')
        }

        setBalance(nextBalance)
      } catch (err) {
        if (err?.name === 'AbortError') {
          return
        }

        setBalance(null)
        setError('Unable to load balance.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchWallet()

    return () => {
      controller.abort()
    }
  }, [token])

  const user = getStoredUser()
  const firstName = user?.fname?.trim()
  const lastName = user?.lname?.trim()
  const hasFirstName = Boolean(firstName)
  const greetingLabel = hasFirstName ? `Good morning, ${firstName}` : 'Good morning'
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'Frontend Customer'
  const initials = `${firstName?.[0] || 'F'}${lastName?.[0] || 'C'}`.toUpperCase()
  const formattedBalance = Number.isFinite(balance) ? `K ${Number(balance).toFixed(2)}` : 'K 0.00'

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Sidebar navigation">
          <div className="sidebar-brand">SME WALLET</div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <button type="button" className="nav-item active">
              Dashboard
            </button>
            <button type="button" className="nav-item">
              My Wallet
            </button>
            <button type="button" className="nav-item">
              Transactions
            </button>
            <button type="button" className="nav-item">
              Settings
            </button>
          </nav>
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-header">
            <div className="header-spacer" aria-hidden="true" />

            <div className="user-profile" aria-label="Logged in user">
              <div className="user-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="user-meta">
                <span className="user-label">Account</span>
                <strong>{fullName}</strong>
              </div>
            </div>
          </header>

          <section className="welcome-block" aria-labelledby="dashboard-greeting">
            <h1 id="dashboard-greeting">{greetingLabel}</h1>
            <p>Here&apos;s your wallet overview.</p>
          </section>

          <section className="balance-card" aria-label="Wallet balance">
            <div className="balance-shape shape-one" aria-hidden="true" />
            <div className="balance-shape shape-two" aria-hidden="true" />

            <div className="balance-header">
              <span className="balance-label">Wallet Balance</span>
            </div>

            {isLoading ? (
              <div className="balance-status loading">Loading balance...</div>
            ) : error ? (
              <div className="balance-status error">{error}</div>
            ) : (
              <div className="balance-amount">{formattedBalance}</div>
            )}
            <div className="balance-meta">Available balance</div>
          </section>

          <section className="quick-actions" aria-labelledby="quick-actions-heading">
            <div className="section-heading-row">
              <h2 id="quick-actions-heading">Quick Actions</h2>
            </div>

            <div className="action-grid">
              <button type="button" className="action-card deposit-card">
                <span className="action-title">Deposit</span>
                <span className="action-text">Add money to your wallet</span>
              </button>

              <button type="button" className="action-card withdraw-card">
                <span className="action-title">Withdraw</span>
                <span className="action-text">Send money to your bank</span>
              </button>

              <button type="button" className="action-card transfer-card">
                <span className="action-title">Transfer</span>
                <span className="action-text">Send money to an SME</span>
              </button>
            </div>
          </section>

          <section className="transactions-panel" aria-labelledby="transactions-heading">
            <div className="section-heading-row">
              <h2 id="transactions-heading">Recent Transactions</h2>
            </div>

            <div className="empty-state">
              <p>No transactions yet</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default Dashboard
