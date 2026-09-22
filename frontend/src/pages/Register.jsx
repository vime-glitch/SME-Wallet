import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Register.css'

const initialForm = {
  fname: '',
  lname: '',
  ph_number: '',
  email: '',
  location: '',
  postal_address: '',
  password: '',
  confirmPassword: '',
  account_type: 'customer',
  business_name: '',
  business_type: '',
  business_address: '',
  date_registered: '',
  bank_id: '',
  account_number: '',
  confirmAccountNumber: '',
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [banks, setBanks] = useState([])
  const [isLoadingBanks, setIsLoadingBanks] = useState(true)
  const [bankLoadError, setBankLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const showBusinessFields =
    form.account_type === 'sme' || form.account_type === 'both'

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/banks')
        const data = await response.json()

        if (!response.ok) {
          throw new Error('Unable to load banks.')
        }

        setBanks(Array.isArray(data?.banks) ? data.banks : [])
      } catch {
        setBankLoadError('Unable to load banks. You can continue without adding a bank account.')
      } finally {
        setIsLoadingBanks(false)
      }
    }

    fetchBanks()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setServerError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationErrors = {}
    const requiredFields = {
      fname: 'First name is required.',
      lname: 'Last name is required.',
      ph_number: 'Phone number is required.',
      email: 'Email is required.',
      location: 'Location is required.',
      postal_address: 'Postal address is required.',
      password: 'Password is required.',
      confirmPassword: 'Please confirm your password.',
    }

    Object.entries(requiredFields).forEach(([field, message]) => {
      if (!form[field].trim()) {
        validationErrors[field] = message
      }
    })

    if (form.password && form.password.length < 8) {
      validationErrors.password = 'Password must be at least 8 characters.'
    }

    if (
      form.password &&
      form.confirmPassword &&
      form.password !== form.confirmPassword
    ) {
      validationErrors.confirmPassword = 'Passwords do not match.'
    }

    if (!['customer', 'sme', 'both'].includes(form.account_type)) {
      validationErrors.account_type = 'Please select an account type.'
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      validationErrors.email = 'Please enter a valid email address.'
    }

    if (showBusinessFields) {
      const businessFields = {
        business_name: 'Business name is required.',
        business_type: 'Business type is required.',
        business_address: 'Business address is required.',
        date_registered: 'Date registered is required.',
      }

      Object.entries(businessFields).forEach(([field, message]) => {
        if (!form[field].trim()) {
          validationErrors[field] = message
        }
      })
    }

    const hasBankDetails =
      Boolean(form.bank_id) ||
      Boolean(form.account_number.trim()) ||
      Boolean(form.confirmAccountNumber.trim())

    if (hasBankDetails) {
      if (!form.bank_id) {
        validationErrors.bank_id = 'Please select a bank.'
      }

      if (!form.account_number.trim()) {
        validationErrors.account_number = 'Account number is required.'
      }

      if (
        !form.confirmAccountNumber.trim() ||
        form.account_number.trim() !== form.confirmAccountNumber.trim()
      ) {
        validationErrors.confirmAccountNumber = 'Account numbers do not match.'
      }
    }

    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const requestBody = {
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      ph_number: form.ph_number.trim(),
      email: form.email.trim(),
      location: form.location.trim(),
      postal_address: form.postal_address.trim(),
      password: form.password,
      account_type: form.account_type,
    }

    if (showBusinessFields) {
      Object.assign(requestBody, {
        business_name: form.business_name.trim(),
        business_type: form.business_type.trim(),
        business_address: form.business_address.trim(),
        date_registered: form.date_registered,
      })
    }

    if (hasBankDetails && !validationErrors.bank_id && !validationErrors.account_number && !validationErrors.confirmAccountNumber) {
      Object.assign(requestBody, {
        bank_id: Number(form.bank_id),
        account_number: form.account_number.trim(),
      })
    }

    setServerError('')
    setSuccessMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()

      if (!response.ok) {
        setServerError(data.message || 'Registration failed. Please try again.')
        return
      }

      setSuccessMessage('Registration successful. Please log in.')
      window.setTimeout(() => navigate('/login'), 1000)
    } catch {
      setServerError('Unable to connect to the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const errorProps = (field) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  })

  return (
    <main className="register-page">
      <div className="register-shell">
        <aside className="register-brand-panel" aria-label="SME Wallet">
          <div className="register-contour register-contour-one" aria-hidden="true" />
          <div className="register-contour register-contour-two" aria-hidden="true" />
          <div className="register-contour register-contour-three" aria-hidden="true" />
          <div className="register-brand-copy">
            <p className="register-wordmark">SME WALLET</p>
            <p className="register-tagline">
              Simple. Secure. Built for your business.
            </p>
          </div>
        </aside>

        <section className="register-card" aria-labelledby="register-heading">
          <div className="register-header">
            <p className="register-brand">SME WALLET</p>
            <h1 id="register-heading">Create Your Account</h1>
            <p>Create your secure SME Wallet account.</p>
          </div>

          <form className="register-form" onSubmit={handleSubmit} noValidate>
            <fieldset className="register-section">
              <legend>Personal Information</legend>
              <div className="register-grid register-grid-two">
                <div className="register-field">
                  <label htmlFor="fname">First name</label>
                  <input
                    id="fname"
                    name="fname"
                    type="text"
                    placeholder="Enter your first name"
                    value={form.fname}
                    onChange={handleChange}
                    autoComplete="given-name"
                    {...errorProps('fname')}
                  />
                  {errors.fname && <p id="fname-error" className="register-error">{errors.fname}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="lname">Last name</label>
                  <input
                    id="lname"
                    name="lname"
                    type="text"
                    placeholder="Enter your last name"
                    value={form.lname}
                    onChange={handleChange}
                    autoComplete="family-name"
                    {...errorProps('lname')}
                  />
                  {errors.lname && <p id="lname-error" className="register-error">{errors.lname}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="ph_number">Phone number</label>
                  <input
                    id="ph_number"
                    name="ph_number"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={form.ph_number}
                    onChange={handleChange}
                    autoComplete="tel"
                    {...errorProps('ph_number')}
                  />
                  {errors.ph_number && <p id="ph_number-error" className="register-error">{errors.ph_number}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    {...errorProps('email')}
                  />
                  {errors.email && <p id="email-error" className="register-error">{errors.email}</p>}
                </div>
              </div>
            </fieldset>

            <fieldset className="register-section">
              <legend>Address Information</legend>
              <div className="register-grid register-grid-two">
                <div className="register-field">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    placeholder="City or region"
                    value={form.location}
                    onChange={handleChange}
                    autoComplete="address-level2"
                    {...errorProps('location')}
                  />
                  {errors.location && <p id="location-error" className="register-error">{errors.location}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="postal_address">Postal address</label>
                  <input
                    id="postal_address"
                    name="postal_address"
                    type="text"
                    placeholder="Enter your postal address"
                    value={form.postal_address}
                    onChange={handleChange}
                    autoComplete="street-address"
                    {...errorProps('postal_address')}
                  />
                  {errors.postal_address && <p id="postal_address-error" className="register-error">{errors.postal_address}</p>}
                </div>
              </div>
            </fieldset>

            <fieldset className="register-section">
              <legend>Account Information</legend>
              <div className="register-field account-type-field">
                <span className="register-label">Account type</span>
                <div className="account-options" role="radiogroup" aria-describedby={errors.account_type ? 'account_type-error' : undefined}>
                  {[
                    ['customer', 'Customer'],
                    ['sme', 'SME'],
                    ['both', 'Both'],
                  ].map(([value, label]) => (
                    <label className="account-option" key={value}>
                      <input
                        type="radio"
                        name="account_type"
                        value={value}
                        checked={form.account_type === value}
                        onChange={handleChange}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {errors.account_type && <p id="account_type-error" className="register-error">{errors.account_type}</p>}
              </div>

              <div className="register-grid register-grid-two">
                <div className="register-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    {...errorProps('password')}
                  />
                  {errors.password && <p id="password-error" className="register-error">{errors.password}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    {...errorProps('confirmPassword')}
                  />
                  {errors.confirmPassword && <p id="confirmPassword-error" className="register-error">{errors.confirmPassword}</p>}
                </div>
              </div>
            </fieldset>

            {showBusinessFields && (
              <fieldset className="register-section">
                <legend>Business Information</legend>
                <div className="register-grid register-grid-two">
                  <div className="register-field">
                    <label htmlFor="business_name">Business name</label>
                    <input
                      id="business_name"
                      name="business_name"
                      type="text"
                      placeholder="Enter your business name"
                      value={form.business_name}
                      onChange={handleChange}
                      {...errorProps('business_name')}
                    />
                    {errors.business_name && <p id="business_name-error" className="register-error">{errors.business_name}</p>}
                  </div>

                  <div className="register-field">
                    <label htmlFor="business_type">Business type</label>
                    <input
                      id="business_type"
                      name="business_type"
                      type="text"
                      placeholder="e.g. Retail or Services"
                      value={form.business_type}
                      onChange={handleChange}
                      {...errorProps('business_type')}
                    />
                    {errors.business_type && <p id="business_type-error" className="register-error">{errors.business_type}</p>}
                  </div>

                  <div className="register-field">
                    <label htmlFor="business_address">Business address</label>
                    <input
                      id="business_address"
                      name="business_address"
                      type="text"
                      placeholder="Enter your business address"
                      value={form.business_address}
                      onChange={handleChange}
                      {...errorProps('business_address')}
                    />
                    {errors.business_address && <p id="business_address-error" className="register-error">{errors.business_address}</p>}
                  </div>

                  <div className="register-field">
                    <label htmlFor="date_registered">Date registered</label>
                    <input
                      id="date_registered"
                      name="date_registered"
                      type="date"
                      value={form.date_registered}
                      onChange={handleChange}
                      {...errorProps('date_registered')}
                    />
                    {errors.date_registered && <p id="date_registered-error" className="register-error">{errors.date_registered}</p>}
                  </div>
                </div>
              </fieldset>
            )}

            <fieldset className="register-section">
              <legend>Bank Account Details</legend>
              <p className="register-section-help">
                Optional — you can leave this section blank and add a bank account later.
              </p>
              <div className="register-grid register-grid-two">
                <div className="register-field">
                  <label htmlFor="bank_id">Bank</label>
                  <select
                    id="bank_id"
                    name="bank_id"
                    value={form.bank_id}
                    onChange={handleChange}
                    disabled={isLoadingBanks}
                    required={Boolean(form.bank_id || form.account_number || form.confirmAccountNumber)}
                    {...errorProps('bank_id')}
                  >
                    <option value="">Select your bank</option>
                    {banks.map((bank) => (
                      <option key={bank.bank_id} value={bank.bank_id}>
                        {bank.bank_name}
                      </option>
                    ))}
                  </select>
                  {isLoadingBanks && <p className="register-help">Loading banks...</p>}
                  {bankLoadError && <p className="register-error">{bankLoadError}</p>}
                  {errors.bank_id && <p id="bank_id-error" className="register-error">{errors.bank_id}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="account_number">Account number</label>
                  <input
                    id="account_number"
                    name="account_number"
                    type="text"
                    placeholder="Enter your account number"
                    value={form.account_number}
                    onChange={handleChange}
                    autoComplete="off"
                    required={Boolean(form.bank_id || form.account_number || form.confirmAccountNumber)}
                    {...errorProps('account_number')}
                  />
                  {errors.account_number && <p id="account_number-error" className="register-error">{errors.account_number}</p>}
                </div>

                <div className="register-field">
                  <label htmlFor="confirmAccountNumber">Confirm account number</label>
                  <input
                    id="confirmAccountNumber"
                    name="confirmAccountNumber"
                    type="text"
                    placeholder="Re-enter your account number"
                    value={form.confirmAccountNumber}
                    onChange={handleChange}
                    autoComplete="off"
                    required={Boolean(form.bank_id || form.account_number || form.confirmAccountNumber)}
                    {...errorProps('confirmAccountNumber')}
                  />
                  {errors.confirmAccountNumber && (
                    <p id="confirmAccountNumber-error" className="register-error">
                      {errors.confirmAccountNumber}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {serverError && <p className="register-error">{serverError}</p>}
            {successMessage && (
              <p className="register-error" role="status">
                {successMessage}
              </p>
            )}

            <button className="register-submit" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="login-prompt">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </section>
      </div>
    </main>
  )
}

export default Register
