import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const [token] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem('token') || ''
  })
  const [balance, setBalance] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(token))
  const [error, setError] = useState(token ? '' : 'Unable to load balance.')
  const [recentTransactions, setRecentTransactions] = useState([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(Boolean(token))
  const [transactionsError, setTransactionsError] = useState('')
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
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transferRecipient, setTransferRecipient] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferError, setTransferError] = useState('')
  const [transferSuccess, setTransferSuccess] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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

  const handleLogout = () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    window.localStorage.removeItem('token')
    window.localStorage.removeItem('user')
    navigate('/login', { replace: true })
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
        setWalletId(Number(data?.wallet?.wallet_id))
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
    if (!token) {
      return undefined
    }

    const controller = new AbortController()

    const fetchRecentTransactions = async () => {
      setIsLoadingTransactions(true)
      setTransactionsError('')

      try {
        const response = await fetch('http://localhost:5000/api/wallet/transactions', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()

        if (response.status === 401) {
          window.localStorage.removeItem('token')
          window.localStorage.removeItem('user')
          navigate('/login', { replace: true })
          return
        }

        if (!response.ok) {
          throw new Error('Unable to load transaction history.')
        }

        const transactions = Array.isArray(data?.transactions) ? data.transactions : []
        const latestTransactions = [...transactions]
          .sort(
            (first, second) =>
              new Date(second.transaction_datetime).getTime() -
              new Date(first.transaction_datetime).getTime(),
          )
          .slice(0, 5)

        setRecentTransactions(latestTransactions)
      } catch (requestError) {
        if (requestError?.name === 'AbortError') {
          return
        }

        setTransactionsError('Unable to load recent transactions.')
      } finally {
        setIsLoadingTransactions(false)
      }
    }

    fetchRecentTransactions()

    return () => {
      controller.abort()
    }
  }, [navigate, token])

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

  const openTransfer = () => {
    setTransferRecipient('')
    setTransferAmount('')
    setTransferError('')
    setTransferSuccess('')
    setIsTransferring(false)
    setIsTransferOpen(true)
    if (!token) {
      setTransferError('Your session has expired. Please log in again.')
    }
  }

  const closeTransfer = () => {
    if (isTransferring) {
      return
    }

    setIsTransferOpen(false)
    setTransferRecipient('')
    setTransferAmount('')
    setTransferError('')
  }

  const handleTransferSubmit = async (event) => {
    event.preventDefault()

    const trimmedRecipient = transferRecipient.trim()
    const trimmedAmount = transferAmount.trim()
    const numericRecipient = Number(trimmedRecipient)
    const numericAmount = Number(trimmedAmount)

    if (!trimmedRecipient) {
      setTransferError('Recipient SME ID is required.')
      return
    }

    if (!/^\d+$/.test(trimmedRecipient) || !Number.isSafeInteger(numericRecipient) || numericRecipient <= 0) {
      setTransferError('Enter a valid positive integer SME ID.')
      return
    }

    if (!trimmedAmount) {
      setTransferError('Amount is required.')
      return
    }

    if (!/^\d+(\.\d+)?$/.test(trimmedAmount) || !Number.isFinite(numericAmount)) {
      setTransferError('Enter a valid numeric amount.')
      return
    }

    if (numericAmount <= 0) {
      setTransferError('Enter an amount greater than zero.')
      return
    }

    if (!Number.isFinite(balance) || numericAmount > balance) {
      setTransferError('The transfer amount cannot exceed your wallet balance.')
      return
    }

    if (!token) {
      setTransferError('Your session has expired. Please log in again.')
      return
    }

    setIsTransferring(true)
    setTransferError('')
    setTransferSuccess('')

    try {
      const response = await fetch('http://localhost:5000/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: Number(trimmedRecipient),
          amount: Number(trimmedAmount),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setTransferError(data?.message || 'Unable to process transfer. Please try again.')
        return
      }

      const transferReference =
        data?.transaction_reference ||
        data?.reference ||
        data?.transfer_reference ||
        data?.transaction?.reference
      const referenceMessage = transferReference ? ` Reference: ${transferReference}` : ''
      const transferredAmount = Number(data?.transferred_amount)
      const successfulAmount = Number.isFinite(transferredAmount) ? transferredAmount : numericAmount
      setTransferSuccess(
        `Transfer of K ${successfulAmount.toFixed(2)} successful.${referenceMessage}`,
      )

      const updatedBalance = Number(
        data?.wallet?.balance ?? data?.updated_sender_wallet_balance,
      )
      if (Number.isFinite(updatedBalance)) {
        setBalance(updatedBalance)
      }

      setIsTransferOpen(false)
      setTransferRecipient('')
      setTransferAmount('')

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
      setTransferError('Unable to connect to the server. Please try again.')
    } finally {
      setIsTransferring(false)
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
  const hasCustomerRole =
    Array.isArray(user?.roles) &&
    user.roles.some((role) => typeof role === 'string' && role.toLowerCase() === 'customer')
  const formatTransactionDate = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
  }
  const getRecentTransactionPresentation = (transaction) => {
    const type = String(transaction.transaction_type || '').toLowerCase()
    const isTransfer = type.includes('transfer')
    const isIncoming =
      type.includes('deposit') ||
      (isTransfer && walletId !== null && transaction.receiver_wallet_id === walletId)
    const isOutgoing =
      type.includes('withdraw') ||
      (isTransfer && walletId !== null && transaction.sender_wallet_id === walletId)

    return {
      amountClass: isIncoming
        ? 'recent-transaction-amount incoming'
        : isOutgoing
          ? 'recent-transaction-amount outgoing'
          : 'recent-transaction-amount',
      amountPrefix: isIncoming ? '+' : isOutgoing ? '-' : '',
      directionLabel: isIncoming ? 'Money in' : isOutgoing ? 'Money out' : '',
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Sidebar navigation">
          <div className="sidebar-brand">SME WALLET</div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <button type="button" className="nav-item active">
              Dashboard
            </button>
            <button type="button" className="nav-item" onClick={() => navigate('/wallet')}>
              My Wallet
            </button>
            <button type="button" className="nav-item" onClick={() => navigate('/transactions')}>
              Transactions
            </button>
            <button type="button" className="nav-item">
              Settings
            </button>
          </nav>
          <button
            type="button"
            className="nav-item logout-button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging Out...' : 'Log Out'}
          </button>
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
            {transferSuccess && (
              <p className="dashboard-success" role="status">
                {transferSuccess}
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

              {hasCustomerRole && (
                <button type="button" className="action-card transfer-card" onClick={openTransfer}>
                  <span className="action-title">Transfer</span>
                  <span className="action-text">Send money to an SME</span>
                </button>
              )}
            </div>
          </section>

          <section className="transactions-panel" aria-labelledby="transactions-heading">
            <div className="section-heading-row">
              <h2 id="transactions-heading">Recent Transactions</h2>
              <button
                type="button"
                className="view-transactions-button"
                onClick={() => navigate('/transactions')}
              >
                View All Transactions
              </button>
            </div>

            {isLoadingTransactions ? (
              <div className="empty-state transactions-loading">
                <p>Loading recent transactions...</p>
              </div>
            ) : transactionsError ? (
              <div className="empty-state transactions-preview-error" role="alert">
                <p>{transactionsError}</p>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="empty-state">
                <p>
                  Your transactions will appear here once you make a deposit, withdrawal, or
                  transfer.
                </p>
              </div>
            ) : (
              <div className="recent-transaction-list" aria-label="Recent transactions">
                {recentTransactions.map((transaction) => {
                  const presentation = getRecentTransactionPresentation(transaction)

                  return (
                    <article
                      className="recent-transaction-card"
                      key={transaction.transaction_id}
                    >
                      <div className="recent-transaction-main">
                        <div className="recent-transaction-heading">
                          <h3>{transaction.transaction_type || 'Wallet transaction'}</h3>
                          <span className="recent-transaction-status">
                            {transaction.transaction_status || 'Status unavailable'}
                          </span>
                        </div>
                        <p>{transaction.description || 'No description available.'}</p>
                        <span className="recent-transaction-date">
                          {formatTransactionDate(transaction.transaction_datetime)}
                        </span>
                      </div>
                      <div className="recent-transaction-amount-wrap">
                        <strong className={presentation.amountClass}>
                          {presentation.amountPrefix}K{Number(transaction.amount).toFixed(2)}
                        </strong>
                        {presentation.directionLabel && (
                          <span className="recent-transaction-direction">
                            {presentation.directionLabel}
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
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
      {isTransferOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="deposit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-heading"
          >
            <div className="deposit-modal-header">
              <div>
                <p className="modal-eyebrow">Wallet action</p>
                <h2 id="transfer-heading">Transfer Funds</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeTransfer}
                disabled={isTransferring}
                aria-label="Close transfer dialog"
              >
                ×
              </button>
            </div>

            <p className="deposit-instruction">
              Ask the recipient to provide their SME ID, then enter the amount you would like to
              transfer.
            </p>

            <form className="deposit-form" onSubmit={handleTransferSubmit} noValidate>
              <div className="deposit-field">
                <label htmlFor="transfer-recipient">Recipient SME ID</label>
                <input
                  id="transfer-recipient"
                  name="transferRecipient"
                  className="modal-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter SME ID"
                  value={transferRecipient}
                  onChange={(event) => {
                    setTransferRecipient(event.target.value)
                    setTransferError('')
                  }}
                  aria-invalid={Boolean(transferError)}
                  aria-describedby={transferError ? 'transfer-error' : undefined}
                  disabled={isTransferring}
                  autoFocus
                />
              </div>

              <div className="deposit-field">
                <label htmlFor="transfer-amount">Amount</label>
                <div className="amount-input">
                  <span aria-hidden="true">K</span>
                  <input
                    id="transfer-amount"
                    name="transferAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(event) => {
                      setTransferAmount(event.target.value)
                      setTransferError('')
                    }}
                    aria-invalid={Boolean(transferError)}
                    aria-describedby={transferError ? 'transfer-error' : undefined}
                    disabled={isTransferring}
                  />
                </div>
              </div>

              {transferError && (
                <p id="transfer-error" className="deposit-error" role="alert">
                  {transferError}
                </p>
              )}

              <div className="deposit-modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={closeTransfer}
                  disabled={isTransferring}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit" disabled={isTransferring}>
                  {isTransferring ? 'Processing...' : 'Transfer'}
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
