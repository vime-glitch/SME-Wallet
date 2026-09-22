-- SME Wallet database schema
-- PostgreSQL-compatible relational schema for a digital wallet and banking platform.
-- Table creation order follows dependency order: parent/reference tables first, then dependent tables.

CREATE TABLE users (
    user_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fname varchar(100) NOT NULL,
    lname varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Stores the basic information of every registered user.';

CREATE TABLE user_contact_info (
    user_id integer PRIMARY KEY,
    ph_number varchar(30) NOT NULL,
    email varchar(255) NOT NULL UNIQUE,
    location varchar(255) NOT NULL,
    postal_address text NOT NULL,
    CONSTRAINT fk_user_contact_info_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

COMMENT ON TABLE user_contact_info IS 'Stores contact and address information for one user.';

CREATE TABLE customer (
    customer_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_customer_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

COMMENT ON TABLE customer IS 'Identifies users who are registered customers of the platform.';

CREATE TABLE sme (
    sme_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL,
    business_name varchar(200) NOT NULL,
    business_type varchar(100) NOT NULL,
    business_address text NOT NULL,
    date_registered date NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_sme_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_sme_user_id ON sme (user_id);
COMMENT ON TABLE sme IS 'Stores information about registered small and medium enterprises.';

CREATE TABLE bank (
    bank_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bank_name varchar(200) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bank IS 'Stores supported banks in the ecosystem.';

CREATE TABLE wallet (
    wallet_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL,
    balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_date timestamptz NOT NULL DEFAULT now(),
    status varchar(20) NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
    CONSTRAINT fk_wallet_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_wallet_user_id ON wallet (user_id);
CREATE INDEX idx_wallet_status ON wallet (status);
COMMENT ON TABLE wallet IS 'Stores digital wallet information and current balance for each user.';

CREATE TABLE user_account_details (
    user_account_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL,
    bank_id integer NOT NULL,
    account_number varchar(30) NOT NULL,
    account_name varchar(150) NOT NULL,
    account_type varchar(20) NOT NULL CHECK (account_type IN ('savings', 'current', 'business', 'loan')),
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    date_added timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_account_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_account_bank
        FOREIGN KEY (bank_id)
        REFERENCES bank (bank_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_user_account_number
        CHECK (account_number ~ '^[A-Za-z0-9- ]{6,30}$'),
    CONSTRAINT uq_user_account_bank_account_number
        UNIQUE (bank_id, account_number)
);

CREATE INDEX idx_user_account_details_user_id ON user_account_details (user_id);
CREATE INDEX idx_user_account_details_bank_id ON user_account_details (bank_id);
COMMENT ON TABLE user_account_details IS 'Stores a user''s linked bank account information.';

CREATE TABLE transaction_type (
    transaction_type_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_name varchar(100) NOT NULL UNIQUE,
    description text NOT NULL
);

COMMENT ON TABLE transaction_type IS 'Defines the supported transaction types such as wallet transfer, deposit, and withdrawal.';

CREATE TABLE transaction_status (
    transaction_status_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status_name varchar(100) NOT NULL UNIQUE,
    description text NOT NULL
);

COMMENT ON TABLE transaction_status IS 'Defines the possible states of a transaction.';

CREATE TABLE transactions (
    transaction_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_wallet_id integer,
    receiver_wallet_id integer,
    user_account_id integer,
    initiated_by_user_id integer NOT NULL,
    transaction_type_id integer NOT NULL,
    transaction_status_id integer NOT NULL,
    amount numeric(18,2) NOT NULL CHECK (amount > 0),
    transaction_datetime timestamptz NOT NULL DEFAULT now(),
    description text,
    reference_number varchar(100) NOT NULL UNIQUE,
    CONSTRAINT fk_transaction_sender_wallet
        FOREIGN KEY (sender_wallet_id)
        REFERENCES wallet (wallet_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_receiver_wallet
        FOREIGN KEY (receiver_wallet_id)
        REFERENCES wallet (wallet_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_user_account
        FOREIGN KEY (user_account_id)
        REFERENCES user_account_details (user_account_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_initiated_by_user
        FOREIGN KEY (initiated_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_type
        FOREIGN KEY (transaction_type_id)
        REFERENCES transaction_type (transaction_type_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_status
        FOREIGN KEY (transaction_status_id)
        REFERENCES transaction_status (transaction_status_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_transaction_participants
        CHECK (
            sender_wallet_id IS NOT NULL
            OR receiver_wallet_id IS NOT NULL
            OR user_account_id IS NOT NULL
        ),
    CONSTRAINT chk_transaction_no_self_wallet_transfer
        CHECK (NOT (sender_wallet_id IS NOT NULL AND receiver_wallet_id IS NOT NULL AND sender_wallet_id = receiver_wallet_id))
);

CREATE INDEX idx_transactions_sender_wallet_id ON transactions (sender_wallet_id);
CREATE INDEX idx_transactions_receiver_wallet_id ON transactions (receiver_wallet_id);
CREATE INDEX idx_transactions_user_account_id ON transactions (user_account_id);
CREATE INDEX idx_transactions_initiated_by_user_id ON transactions (initiated_by_user_id);
CREATE INDEX idx_transactions_type_status ON transactions (transaction_type_id, transaction_status_id);
CREATE INDEX idx_transactions_transaction_datetime ON transactions (transaction_datetime);
COMMENT ON TABLE transactions IS 'Stores all financial transactions performed through the system. Sender, receiver, and bank-account fields are nullable to support transaction types such as deposit, withdrawal, or payment where not all participant fields are used.';

CREATE TABLE contacts (
    contact_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL,
    contact_user_id integer NOT NULL,
    date_added timestamptz NOT NULL DEFAULT now(),
    status varchar(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    CONSTRAINT fk_contact_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_contact_contact_user
        FOREIGN KEY (contact_user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_contact_not_self
        CHECK (user_id <> contact_user_id),
    CONSTRAINT uq_contact_user_pair
        UNIQUE (user_id, contact_user_id)
);

CREATE INDEX idx_contacts_user_id ON contacts (user_id);
CREATE INDEX idx_contacts_contact_user_id ON contacts (contact_user_id);
COMMENT ON TABLE contacts IS 'Stores user-to-user relationships for saved contacts.';

CREATE TABLE role (
    role_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name varchar(100) NOT NULL UNIQUE,
    description text NOT NULL
);

COMMENT ON TABLE role IS 'Defines the available system roles.';

CREATE TABLE user_role (
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    assigned_date timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id)
        REFERENCES role (role_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_user_role_role_id ON user_role (role_id);
COMMENT ON TABLE user_role IS 'Associative table that implements the many-to-many relationship between users and roles.';

CREATE TABLE log (
    log_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer,
    action varchar(150) NOT NULL,
    description text NOT NULL,
    log_datetime timestamptz NOT NULL DEFAULT now(),
    ip_address inet,
    status varchar(20) NOT NULL CHECK (status IN ('info', 'success', 'warning', 'failure')),
    CONSTRAINT fk_log_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_log_user_id ON log (user_id);
CREATE INDEX idx_log_datetime ON log (log_datetime);
COMMENT ON TABLE log IS 'Stores system and security activity for auditing and operational monitoring.';

-- Additional indexes for common lookup and reporting queries.
CREATE INDEX idx_users_fname_lname ON users (fname, lname);
CREATE INDEX idx_user_contact_info_email ON user_contact_info (email);
CREATE INDEX idx_customer_user_id ON customer (user_id);
CREATE INDEX idx_wallet_balance ON wallet (balance);
CREATE INDEX idx_user_account_details_default_active ON user_account_details (is_default, is_active);
CREATE INDEX idx_transactions_amount ON transactions (amount);
CREATE INDEX idx_contacts_status ON contacts (status);
CREATE INDEX idx_log_status ON log (status);

CREATE TABLE user_authentication(
    auth_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    is_active boolean NOT NULL DEFAULT true, 
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_authentication_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);