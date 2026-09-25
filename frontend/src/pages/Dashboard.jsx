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
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositError, setDepositError] = useState('')
  const [depositSuccess, setDepositSuccess] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAccountId, setWithdrawAccountId] = useState('')
  const [withdrawAccounts, setWithdrawAccounts] = useState([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

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

  useEffect(() => {
    if (!isWithdrawOpen) {
      return undefined
    }

    if (!token) {
      return undefined
    }

    const controller = new AbortController()

    const fetchAccounts = async () => {
      setIsLoadingAccounts(true)
      setWithdrawError('')
      setWithdrawAccounts([])
      setWithdrawAccountId('')

      try {
        const response = await fetch('http://localhost:5000/api/wallet/accounts', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to load bank accounts.')
        }

        const accounts = Array.isArray(data?.accounts) ? data.accounts : []
        setWithdrawAccounts(accounts)
        if (accounts.length > 0) {
          setWithdrawAccountId(String(accounts[0].account_id))
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          return
        }

        setWithdrawError(err?.message || 'Unable to load bank accounts.')
      } finally {
        setIsLoadingAccounts(false)
      }
    }

    fetchAccounts()

    return () => {
      controller.abort()
    }
  }, [isWithdrawOpen, token])

  const openDeposit = () => {
    setDepositAmount('')
    setDepositError('')
    setDepositSuccess('')
    setIsDepositOpen(true)
  }

  const closeDeposit = () => {
    if (isDepositing) {
      return
    }

    setIsDepositOpen(false)
    setDepositAmount('')
    setDepositError('')
  }

  const handleDepositSubmit = async (event) => {
    event.preventDefault()

    const trimmedAmount = depositAmount.trim()
    const numericAmount = Number(trimmedAmount)

    if (!trimmedAmount) {
      setDepositError('Amount is required.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setDepositError('Enter a positive amount.')
      return
    }

    if (!token) {
      setDepositError('Your session has expired. Please log in again.')
      return
    }

    setIsDepositing(true)
    setDepositError('')
    setDepositSuccess('')

    try {
      const response = await fetch('http://localhost:5000/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numericAmount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setDepositError(data?.message || 'Unable to process deposit. Please try again.')
        return
      }

      const updatedBalance = Number(data?.wallet?.balance)

      if (!Number.isFinite(updatedBalance)) {
        setDepositError('Unable to process deposit. Please try again.')
        return
      }

      setBalance(updatedBalance)
      setIsDepositOpen(false)
      setDepositAmount('')
      setDepositError('')
      setDepositSuccess('Deposit successful.')
    } catch {
      setDepositError('Unable to connect to the server. Please try again.')
    } finally {
      setIsDepositing(false)
    }
  }

  const openWithdraw = () => {
    setWithdrawAmount('')
    setWithdrawAccountId('')
    setWithdrawAccounts([])
    setWithdrawError('')
    setWithdrawSuccess('')
    setIsWithdrawOpen(true)
    if (!token) {
      setWithdrawError('Your session has expired. Please log in again.')
    }
  }

  const closeWithdraw = () => {
    if (isWithdrawing) {
      return
    }

    setIsWithdrawOpen(false)
    setWithdrawAmount('')
    setWithdrawAccountId('')
    setWithdrawError('')
  }

  const handleWithdrawSubmit = async (event) => {
    event.preventDefault()

    const trimmedAmount = withdrawAmount.trim()
    const numericAmount = Number(trimmedAmount)

    if (!trimmedAmount) {
      setWithdrawError('Amount is required.')
      return
    }

    if (!/^\d+(\.\d+)?$/.test(trimmedAmount) || !Number.isFinite(numericAmount)) {
      setWithdrawError('Enter a valid numeric amount.')
      return
    }

    if (numericAmount <= 0) {
      setWithdrawError('Enter an amount greater than zero.')
      return
    }

    if (!Number.isFinite(balance) || numericAmount > balance) {
      setWithdrawError('The withdrawal amount cannot exceed your wallet balance.')
      return
    }

    if (!withdrawAccountId || withdrawAccounts.length === 0) {
      setWithdrawError('Please select a registered bank account.')
      return
    }

    if (!token) {
      setWithdrawError('Your session has expired. Please log in again.')
      return
    }

    setIsWithdrawing(true)
    setWithdrawError('')
    setWithdrawSuccess('')

    try {
      const response = await fetch('http://localhost:5000/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          account_id: Number(withdrawAccountId),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setWithdrawError(data?.message || 'Unable to process withdrawal. Please try again.')
        return
      }

      const updatedBalance = Number(data?.wallet?.balance)
      if (Number.isFinite(updatedBalance)) {
        setBalance(updatedBalance)
      }

      setWithdrawSuccess('Withdrawal successful.')
      setIsWithdrawOpen(false)
      setWithdrawAmount('')
      setWithdrawAccountId('')
      setWithdrawError('')
      setWithdrawAccounts([])

      const walletResponse = await fetch('http://localhost:5000/api/wallet', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })
      const walletData = await walletResponse.json()
      if (walletResponse.ok && Number.isFinite(Number(walletData?.wallet?.balance))) {
        setBalance(Number(walletData.wallet.balance))
      }
    } catch {
      setWithdrawError('Unable to connect to the server. Please try again.')
    } finally {
      setIsWithdrawing(false)
    }
  }

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
            {depositSuccess && (
              <p className="dashboard-success" role="status">
                {depositSuccess}
              </p>
            )}
            {withdrawSuccess && (
              <p className="dashboard-success" role="status">
                {withdrawSuccess}
              </p>
            )}
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
              <button type="button" className="action-card deposit-card" onClick={openDeposit}>
                <span className="action-title">Deposit</span>
                <span className="action-text">Add money to your wallet</span>
              </button>

              <button type="button" className="action-card withdraw-card" onClick={openWithdraw}>
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

      {isDepositOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="deposit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-heading"
          >
            <div className="deposit-modal-header">
              <div>
                <p className="modal-eyebrow">Wallet action</p>
                <h2 id="deposit-heading">Deposit Funds</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeposit}
                disabled={isDepositing}
                aria-label="Close deposit dialog"
              >
                ×
              </button>
            </div>

            <p className="deposit-instruction">
              Enter the amount you would like to add to your wallet.
            </p>

            <form className="deposit-form" onSubmit={handleDepositSubmit} noValidate>
              <div className="deposit-field">
                <label htmlFor="deposit-amount">Amount</label>
                <div className="amount-input">
                  <span aria-hidden="true">K</span>
                  <input
                    id="deposit-amount"
                    name="depositAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(event) => {
                      setDepositAmount(event.target.value)
                      setDepositError('')
                    }}
                    aria-invalid={Boolean(depositError)}
                    aria-describedby={depositError ? 'deposit-error' : undefined}
                    disabled={isDepositing}
                    autoFocus
                  />
                </div>
                {depositError && (
                  <p id="deposit-error" className="deposit-error" role="alert">
                    {depositError}
                  </p>
                )}
              </div>

              <div className="deposit-modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={closeDeposit}
                  disabled={isDepositing}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit" disabled={isDepositing}>
                  {isDepositing ? 'Processing...' : 'Deposit'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
                      {isWithdrawOpen && (
                  <div className="modal-backdrop" role="presentation">
                    <section
                      className="deposit-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="withdraw-heading"
                    >
                      <div className="deposit-modal-header">
                        <div>
                          <p className="modal-eyebrow">Wallet action</p>
                          <h2 id="withdraw-heading">Withdraw Funds</h2>
                        </div>
                        <button
                          type="button"
                          className="modal-close"
                          onClick={closeWithdraw}
                          disabled={isWithdrawing}
                          aria-label="Close withdrawal dialog"
                        >
                          ×
                        </button>
                      </div>

                      <p className="deposit-instruction">
                        Choose a registered bank account and enter the amount you would like to withdraw.
                      </p>

                      <form className="deposit-form" onSubmit={handleWithdrawSubmit} noValidate>
                        <div className="deposit-field">
                          <label htmlFor="withdraw-amount">Amount</label>
                          <div className="amount-input">
                            <span aria-hidden="true">K</span>
                            <input
                              id="withdraw-amount"
                              name="withdrawAmount"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={withdrawAmount}
                              onChange={(event) => {
                                setWithdrawAmount(event.target.value)
                                setWithdrawError('')
                              }}
                              aria-invalid={Boolean(withdrawError)}
                              aria-describedby={withdrawError ? 'withdraw-error' : undefined}
                              disabled={isWithdrawing}
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="deposit-field">
                          <label htmlFor="withdraw-account">Registered bank account</label>
                          {isLoadingAccounts ? (
                            <p className="deposit-instruction account-status">Loading bank accounts...</p>
                          ) : withdrawAccounts.length === 0 ? (
                            <p className="deposit-instruction account-status">
                              No registered bank accounts found. Please register a bank account before
                              withdrawing.
                            </p>
                          ) : (
                            <select
                              id="withdraw-account"
                              name="withdrawAccount"
                              className="account-select"
                              value={withdrawAccountId}
                              onChange={(event) => {
                                setWithdrawAccountId(event.target.value)
                                setWithdrawError('')
                              }}
                              disabled={isWithdrawing}
                            >
                              {withdrawAccounts.map((account) => (
                                <option key={account.account_id} value={account.account_id}>
                                  {account.bank_name} - {account.account_number}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {withdrawError && (
                          <p id="withdraw-error" className="deposit-error" role="alert">
                            {withdrawError}
                          </p>
                        )}

                        <div className="deposit-modal-actions">
                          <button
                            type="button"
                            className="modal-cancel"
                            onClick={closeWithdraw}
                            disabled={isWithdrawing}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="modal-submit"
                            disabled={isWithdrawing || isLoadingAccounts || withdrawAccounts.length === 0}
                          >
                            {isWithdrawing ? 'Processing...' : 'Withdraw'}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>
                )}
    </main>
  )
}

export default Dashboard
