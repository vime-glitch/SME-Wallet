import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Transactions.css'

function Transactions() {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [walletId, setWalletId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const token = window.localStorage.getItem('token') || ''

    if (!token) {
      navigate('/login', { replace: true })
      return undefined
    }

    const controller = new AbortController()

    const fetchTransactions = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [transactionsResponse, walletResponse] = await Promise.all([
          fetch('http://localhost:5000/api/wallet/transactions', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch('http://localhost:5000/api/wallet', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: controller.signal,
          }),
        ])

        const transactionsData = await transactionsResponse.json()
        const walletData = await walletResponse.json()

        if (transactionsResponse.status === 401 || walletResponse.status === 401) {
          window.localStorage.removeItem('token')
          window.localStorage.removeItem('user')
          navigate('/login', { replace: true })
          return
        }

        if (!transactionsResponse.ok) {
          throw new Error('Unable to load transaction history.')
        }

        setTransactions(
          Array.isArray(transactionsData?.transactions) ? transactionsData.transactions : [],
        )

        if (walletResponse.ok && Number.isFinite(Number(walletData?.wallet?.wallet_id))) {
          setWalletId(Number(walletData.wallet.wallet_id))
        } else {
          setWalletId(null)
        }
      } catch (requestError) {
        if (requestError?.name === 'AbortError') {
          return
        }

        setError('Unable to load transaction history. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()

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
    const isDeposit = type.includes('deposit')
    const isWithdrawal = type.includes('withdraw')
    const isOutgoingTransfer =
      isTransfer && walletId !== null && transaction.sender_wallet_id === walletId
    const isIncomingTransfer =
      isTransfer && walletId !== null && transaction.receiver_wallet_id === walletId
    const isIncoming = isDeposit || isIncomingTransfer
    const isOutgoing = isWithdrawal || isOutgoingTransfer
    const directionLabel = isIncoming ? 'Money in' : isOutgoing ? 'Money out' : ''

    return {
      amountClass: isIncoming
        ? 'transaction-amount incoming'
        : isOutgoing
          ? 'transaction-amount outgoing'
          : 'transaction-amount',
      isIncoming,
      amountPrefix: isIncoming ? '+' : isOutgoing ? '-' : '',
      directionLabel,
    }
  }

  return (
    <main className="transactions-page">
      <div className="transactions-shell">
        <header className="transactions-header">
          <div>
            <p className="transactions-eyebrow">SME Wallet</p>
            <h1>Transaction History</h1>
            <p>Review your wallet activity in one place.</p>
          </div>
          <button type="button" className="transactions-back" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </header>

        <section className="transactions-content" aria-live="polite">
          {isLoading ? (
            <div className="transactions-state">
              <p>Loading transaction history...</p>
            </div>
          ) : error ? (
            <div className="transactions-state transactions-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="transactions-retry"
                onClick={() => setRetryKey((currentKey) => currentKey + 1)}
              >
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="transactions-state">
              <h2>No transactions yet</h2>
              <p>
                Your transactions will appear here once you make a deposit, withdrawal, or
                transfer.
              </p>
            </div>
          ) : (
            <div className="transaction-list" aria-label="Transaction history">
              {transactions.map((transaction) => {
                const presentation = getTransactionPresentation(transaction)

                return (
                  <article className="transaction-card" key={transaction.transaction_id}>
                    <div className="transaction-card-main">
                      <div className="transaction-card-heading">
                        <h2>{transaction.transaction_type || 'Wallet transaction'}</h2>
                        <span className="transaction-status">
                          {transaction.transaction_status || 'Status unavailable'}
                        </span>
                      </div>
                      <p className="transaction-description">
                        {transaction.description || 'No description available.'}
                      </p>
                      <div className="transaction-meta">
                        <span>{formatDate(transaction.transaction_datetime)}</span>
                        <span>Reference: {transaction.reference_number || 'Unavailable'}</span>
                      </div>
                    </div>
                    <div className="transaction-card-amount">
                      <strong className={presentation.amountClass}>
                        {presentation.amountPrefix}K{Number(transaction.amount).toFixed(2)}
                      </strong>
                      {presentation.directionLabel && (
                        <span className="transaction-direction">{presentation.directionLabel}</span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Transactions
