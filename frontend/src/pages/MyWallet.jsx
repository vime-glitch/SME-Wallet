import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './MyWallet.css'

function MyWallet() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [walletLoading, setWalletLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [walletError, setWalletError] = useState('')
  const [accountsError, setAccountsError] = useState('')
  const [transactionsError, setTransactionsError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const token = window.localStorage.getItem('token') || ''

    if (!token) {
      navigate('/login', { replace: true })
      return undefined
    }

    const controller = new AbortController()
    let redirected = false

    const request = async (url) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (response.status === 401 && !redirected) {
        redirected = true
        window.localStorage.removeItem('token')
        window.localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return null
      }

      return response
    }

    const loadWallet = async () => {
      setWalletLoading(true)
      setWalletError('')

      try {
        const response = await request('http://localhost:5000/api/wallet')
        if (!response) return
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Unable to load wallet information.')
        }

        setWallet(data?.wallet || null)
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setWalletError('Unable to load wallet information.')
        }
      } finally {
        setWalletLoading(false)
      }
    }

    const loadAccounts = async () => {
      setAccountsLoading(true)
      setAccountsError('')

      try {
        const response = await request('http://localhost:5000/api/wallet/accounts')
        if (!response) return
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Unable to load bank accounts.')
        }

        setAccounts(Array.isArray(data?.accounts) ? data.accounts : [])
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setAccountsError('Unable to load bank accounts.')
        }
      } finally {
        setAccountsLoading(false)
      }
    }

    const loadTransactions = async () => {
      setTransactionsLoading(true)
      setTransactionsError('')

      try {
        const response = await request('http://localhost:5000/api/wallet/transactions')
        if (!response) return
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Unable to load wallet activity.')
        }

        const latestTransactions = (Array.isArray(data?.transactions) ? data.transactions : [])
          .slice()
          .sort(
            (first, second) =>
              new Date(second.transaction_datetime).getTime() -
              new Date(first.transaction_datetime).getTime(),
          )
          .slice(0, 3)

        setTransactions(latestTransactions)
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setTransactionsError('Unable to load wallet activity.')
        }
      } finally {
        setTransactionsLoading(false)
      }
    }

    loadWallet()
    loadAccounts()
    loadTransactions()

    return () => {
      controller.abort()
    }
  }, [navigate, retryKey])

  const formatDate = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
  }

  const getTransactionPresentation = (transaction) => {
    const type = String(transaction.transaction_type || '').toLowerCase()
    const isTransfer = type.includes('transfer')
    const currentWalletId = Number(wallet?.wallet_id)
    const isIncoming =
      type.includes('deposit') ||
      (isTransfer &&
        Number.isFinite(currentWalletId) &&
        transaction.receiver_wallet_id === currentWalletId)
    const isOutgoing =
      type.includes('withdraw') ||
      (isTransfer &&
        Number.isFinite(currentWalletId) &&
        transaction.sender_wallet_id === currentWalletId)

    return {
      amountClass: isIncoming
        ? 'wallet-activity-amount incoming'
        : isOutgoing
          ? 'wallet-activity-amount outgoing'
          : 'wallet-activity-amount',
      amountPrefix: isIncoming ? '+' : isOutgoing ? '-' : '',
      directionLabel: isIncoming ? 'Money in' : isOutgoing ? 'Money out' : isTransfer ? 'Transfer' : '',
    }
  }

  const retry = () => setRetryKey((currentKey) => currentKey + 1)
  const balance = Number(wallet?.balance)
  const walletStatus = wallet?.status || 'Status unavailable'

  return (
    <main className="wallet-page">
      <div className="wallet-shell">
        <header className="wallet-header">
          <div>
            <p className="wallet-eyebrow">SME Wallet</p>
            <h1>My Wallet</h1>
            <p>Manage your wallet overview and linked accounts.</p>
          </div>
          <button type="button" className="wallet-header-button" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </header>

        <section className="wallet-summary-card" aria-labelledby="wallet-summary-heading">
          <div>
            <p className="wallet-card-label">Available balance</p>
            {walletLoading ? (
              <p className="wallet-loading">Loading wallet...</p>
            ) : walletError ? (
              <p className="wallet-error" role="alert">{walletError}</p>
            ) : (
              <strong className="wallet-balance">
                {Number.isFinite(balance) ? `K${balance.toFixed(2)}` : 'K0.00'}
              </strong>
            )}
          </div>
          <div className="wallet-summary-meta">
            <span id="wallet-summary-heading" className="wallet-card-label">Wallet status</span>
            <strong>{walletLoading ? 'Loading...' : walletStatus}</strong>
            <span className="wallet-card-label">Created</span>
            <strong>{walletLoading ? 'Loading...' : formatDate(wallet?.created_date)}</strong>
          </div>
        </section>

        <div className="wallet-grid">
          <section className="wallet-card" aria-labelledby="accounts-heading">
            <div className="wallet-section-heading">
              <h2 id="accounts-heading">Registered Bank Accounts</h2>
            </div>
            {accountsLoading ? (
              <p className="wallet-muted">Loading bank accounts...</p>
            ) : accountsError ? (
              <div className="wallet-section-message" role="alert">
                <p className="wallet-error">{accountsError}</p>
                <button type="button" className="wallet-retry" onClick={retry}>Retry</button>
              </div>
            ) : accounts.length === 0 ? (
              <p className="wallet-muted">No bank accounts linked yet.</p>
            ) : (
              <div className="wallet-account-list">
                {accounts.map((account) => (
                  <div className="wallet-account" key={account.account_id}>
                    <strong>{account.bank_name}</strong>
                    <span>{account.account_number}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="wallet-card" aria-labelledby="activity-heading">
            <div className="wallet-section-heading">
              <h2 id="activity-heading">Wallet Activity</h2>
              <button type="button" className="wallet-link" onClick={() => navigate('/transactions')}>
                View All Transactions
              </button>
            </div>
            {transactionsLoading ? (
              <p className="wallet-muted">Loading wallet activity...</p>
            ) : transactionsError ? (
              <div className="wallet-section-message" role="alert">
                <p className="wallet-error">{transactionsError}</p>
                <button type="button" className="wallet-retry" onClick={retry}>Retry</button>
              </div>
            ) : transactions.length === 0 ? (
              <p className="wallet-muted">No wallet activity yet.</p>
            ) : (
              <div className="wallet-activity-list">
                {transactions.map((transaction) => {
                  const presentation = getTransactionPresentation(transaction)

                  return (
                    <article className="wallet-activity" key={transaction.transaction_id}>
                      <div className="wallet-activity-main">
                        <div className="wallet-activity-title">
                          <strong>{transaction.transaction_type || 'Wallet transaction'}</strong>
                          <span>{transaction.transaction_status || 'Status unavailable'}</span>
                        </div>
                        <p>{transaction.description || 'No description available.'}</p>
                        <small>{formatDate(transaction.transaction_datetime)}</small>
                      </div>
                      <div className="wallet-activity-amount-wrap">
                        <strong className={presentation.amountClass}>
                          {presentation.amountPrefix}K{Number(transaction.amount).toFixed(2)}
                        </strong>
                        <small>{presentation.directionLabel}</small>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default MyWallet
