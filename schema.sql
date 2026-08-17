--
-- PostgreSQL database dump
--

\restrict eON4oQiifNOqdRyzu6nvGxS790PHxMDtw1s4XxeZ82MItMk2N9v8ZDLvA7GxFTW

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-08-18 01:49:34

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 227 (class 1259 OID 24884)
-- Name: bank; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank (
    bank_id integer NOT NULL,
    bank_name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bank OWNER TO postgres;

--
-- TOC entry 5182 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE bank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bank IS 'Stores supported banks in the ecosystem.';


--
-- TOC entry 226 (class 1259 OID 24883)
-- Name: bank_bank_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.bank ALTER COLUMN bank_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bank_bank_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 239 (class 1259 OID 25035)
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    contact_id integer NOT NULL,
    user_id integer NOT NULL,
    contact_user_id integer NOT NULL,
    date_added timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) NOT NULL,
    CONSTRAINT chk_contact_not_self CHECK ((user_id <> contact_user_id)),
    CONSTRAINT contacts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'blocked'::character varying])::text[])))
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- TOC entry 5183 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE contacts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contacts IS 'Stores user-to-user relationships for saved contacts.';


--
-- TOC entry 238 (class 1259 OID 25034)
-- Name: contacts_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.contacts ALTER COLUMN contact_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contacts_contact_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 223 (class 1259 OID 24843)
-- Name: customer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer (
    customer_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 24842)
-- Name: customer_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.customer ALTER COLUMN customer_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.customer_customer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 244 (class 1259 OID 25096)
-- Name: log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.log (
    log_id integer NOT NULL,
    user_id integer,
    action character varying(150) NOT NULL,
    description text NOT NULL,
    log_datetime timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet,
    status character varying(20) NOT NULL,
    CONSTRAINT log_status_check CHECK (((status)::text = ANY ((ARRAY['info'::character varying, 'success'::character varying, 'warning'::character varying, 'failure'::character varying])::text[])))
);


ALTER TABLE public.log OWNER TO postgres;

--
-- TOC entry 5184 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.log IS 'Stores system and security activity for auditing and operational monitoring.';


--
-- TOC entry 243 (class 1259 OID 25095)
-- Name: log_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.log ALTER COLUMN log_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.log_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 241 (class 1259 OID 25063)
-- Name: role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role (
    role_id integer NOT NULL,
    role_name character varying(100) NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.role OWNER TO postgres;

--
-- TOC entry 5185 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.role IS 'Defines the available system roles.';


--
-- TOC entry 240 (class 1259 OID 25062)
-- Name: role_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.role ALTER COLUMN role_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.role_role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 225 (class 1259 OID 24860)
-- Name: sme; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sme (
    sme_id integer NOT NULL,
    user_id integer NOT NULL,
    business_name character varying(200) NOT NULL,
    business_type character varying(100) NOT NULL,
    business_address text NOT NULL,
    date_registered date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sme OWNER TO postgres;

--
-- TOC entry 5186 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE sme; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sme IS 'Stores information about registered small and medium enterprises.';


--
-- TOC entry 224 (class 1259 OID 24859)
-- Name: sme_sme_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.sme ALTER COLUMN sme_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sme_sme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 235 (class 1259 OID 24965)
-- Name: transaction_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_status (
    transaction_status_id integer NOT NULL,
    status_name character varying(100) NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.transaction_status OWNER TO postgres;

--
-- TOC entry 5187 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE transaction_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transaction_status IS 'Defines the possible states of a transaction.';


--
-- TOC entry 234 (class 1259 OID 24964)
-- Name: transaction_status_transaction_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.transaction_status ALTER COLUMN transaction_status_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.transaction_status_transaction_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 233 (class 1259 OID 24952)
-- Name: transaction_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_type (
    transaction_type_id integer NOT NULL,
    type_name character varying(100) NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.transaction_type OWNER TO postgres;

--
-- TOC entry 5188 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE transaction_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transaction_type IS 'Defines the supported transaction types such as wallet transfer, deposit, and withdrawal.';


--
-- TOC entry 232 (class 1259 OID 24951)
-- Name: transaction_type_transaction_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.transaction_type ALTER COLUMN transaction_type_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.transaction_type_transaction_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 237 (class 1259 OID 24978)
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    transaction_id integer NOT NULL,
    sender_wallet_id integer,
    receiver_wallet_id integer,
    user_account_id integer,
    initiated_by_user_id integer NOT NULL,
    transaction_type_id integer NOT NULL,
    transaction_status_id integer NOT NULL,
    amount numeric(18,2) NOT NULL,
    transaction_datetime timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    reference_number character varying(100) NOT NULL,
    CONSTRAINT chk_transaction_no_self_wallet_transfer CHECK ((NOT ((sender_wallet_id IS NOT NULL) AND (receiver_wallet_id IS NOT NULL) AND (sender_wallet_id = receiver_wallet_id)))),
    CONSTRAINT chk_transaction_participants CHECK (((sender_wallet_id IS NOT NULL) OR (receiver_wallet_id IS NOT NULL) OR (user_account_id IS NOT NULL))),
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- TOC entry 5189 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transactions IS 'Stores all financial transactions performed through the system. Sender, receiver, and bank-account fields are nullable to support transaction types such as deposit, withdrawal, or payment where not all participant fields are used.';


--
-- TOC entry 236 (class 1259 OID 24977)
-- Name: transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ALTER COLUMN transaction_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.transactions_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 231 (class 1259 OID 24918)
-- Name: user_account_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_account_details (
    user_account_id integer NOT NULL,
    user_id integer NOT NULL,
    bank_id integer NOT NULL,
    account_number character varying(30) NOT NULL,
    account_name character varying(150) NOT NULL,
    account_type character varying(20) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    date_added timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_user_account_number CHECK (((account_number)::text ~ '^[A-Za-z0-9- ]{6,30}$'::text)),
    CONSTRAINT user_account_details_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['savings'::character varying, 'current'::character varying, 'business'::character varying, 'loan'::character varying])::text[])))
);


ALTER TABLE public.user_account_details OWNER TO postgres;

--
-- TOC entry 5190 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE user_account_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_account_details IS 'Stores a user''s linked bank account information.';


--
-- TOC entry 230 (class 1259 OID 24917)
-- Name: user_account_details_user_account_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.user_account_details ALTER COLUMN user_account_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_account_details_user_account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 221 (class 1259 OID 24823)
-- Name: user_contact_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_contact_info (
    user_id integer NOT NULL,
    ph_number character varying(30) NOT NULL,
    email character varying(255) NOT NULL,
    location character varying(255) NOT NULL,
    postal_address text NOT NULL
);


ALTER TABLE public.user_contact_info OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 25075)
-- Name: user_role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_role (
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    assigned_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_role OWNER TO postgres;

--
-- TOC entry 5191 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE user_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_role IS 'Associative table that implements the many-to-many relationship between users and roles.';


--
-- TOC entry 220 (class 1259 OID 24813)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    fname character varying(100) NOT NULL,
    lname character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5192 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Stores the basic information of every registered user.';


--
-- TOC entry 219 (class 1259 OID 24812)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 229 (class 1259 OID 24896)
-- Name: wallet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet (
    wallet_id integer NOT NULL,
    user_id integer NOT NULL,
    balance numeric(18,2) DEFAULT 0 NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) NOT NULL,
    CONSTRAINT wallet_balance_check CHECK ((balance >= (0)::numeric)),
    CONSTRAINT wallet_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.wallet OWNER TO postgres;

--
-- TOC entry 5193 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE wallet; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.wallet IS 'Stores digital wallet information and current balance for each user.';


--
-- TOC entry 228 (class 1259 OID 24895)
-- Name: wallet_wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.wallet ALTER COLUMN wallet_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_wallet_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 4960 (class 2606 OID 24894)
-- Name: bank bank_bank_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank
    ADD CONSTRAINT bank_bank_name_key UNIQUE (bank_name);


--
-- TOC entry 4962 (class 2606 OID 24892)
-- Name: bank bank_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank
    ADD CONSTRAINT bank_pkey PRIMARY KEY (bank_id);


--
-- TOC entry 4995 (class 2606 OID 25047)
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (contact_id);


--
-- TOC entry 4952 (class 2606 OID 24851)
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (customer_id);


--
-- TOC entry 4954 (class 2606 OID 24853)
-- Name: customer customer_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_user_id_key UNIQUE (user_id);


--
-- TOC entry 5012 (class 2606 OID 25109)
-- Name: log log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT log_pkey PRIMARY KEY (log_id);


--
-- TOC entry 5002 (class 2606 OID 25072)
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role_id);


--
-- TOC entry 5004 (class 2606 OID 25074)
-- Name: role role_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_role_name_key UNIQUE (role_name);


--
-- TOC entry 4958 (class 2606 OID 24876)
-- Name: sme sme_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sme
    ADD CONSTRAINT sme_pkey PRIMARY KEY (sme_id);


--
-- TOC entry 4980 (class 2606 OID 24974)
-- Name: transaction_status transaction_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_status
    ADD CONSTRAINT transaction_status_pkey PRIMARY KEY (transaction_status_id);


--
-- TOC entry 4982 (class 2606 OID 24976)
-- Name: transaction_status transaction_status_status_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_status
    ADD CONSTRAINT transaction_status_status_name_key UNIQUE (status_name);


--
-- TOC entry 4976 (class 2606 OID 24961)
-- Name: transaction_type transaction_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_type
    ADD CONSTRAINT transaction_type_pkey PRIMARY KEY (transaction_type_id);


--
-- TOC entry 4978 (class 2606 OID 24963)
-- Name: transaction_type transaction_type_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_type
    ADD CONSTRAINT transaction_type_type_name_key UNIQUE (type_name);


--
-- TOC entry 4991 (class 2606 OID 24995)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id);


--
-- TOC entry 4993 (class 2606 OID 24997)
-- Name: transactions transactions_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_reference_number_key UNIQUE (reference_number);


--
-- TOC entry 5000 (class 2606 OID 25049)
-- Name: contacts uq_contact_user_pair; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT uq_contact_user_pair UNIQUE (user_id, contact_user_id);


--
-- TOC entry 4972 (class 2606 OID 24938)
-- Name: user_account_details uq_user_account_bank_account_number; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_details
    ADD CONSTRAINT uq_user_account_bank_account_number UNIQUE (bank_id, account_number);


--
-- TOC entry 4974 (class 2606 OID 24936)
-- Name: user_account_details user_account_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_details
    ADD CONSTRAINT user_account_details_pkey PRIMARY KEY (user_account_id);


--
-- TOC entry 4948 (class 2606 OID 24836)
-- Name: user_contact_info user_contact_info_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_info
    ADD CONSTRAINT user_contact_info_email_key UNIQUE (email);


--
-- TOC entry 4950 (class 2606 OID 24834)
-- Name: user_contact_info user_contact_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_info
    ADD CONSTRAINT user_contact_info_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5007 (class 2606 OID 25083)
-- Name: user_role user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id);


--
-- TOC entry 4945 (class 2606 OID 24822)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4967 (class 2606 OID 24909)
-- Name: wallet wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_pkey PRIMARY KEY (wallet_id);


--
-- TOC entry 4996 (class 1259 OID 25061)
-- Name: idx_contacts_contact_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_contact_user_id ON public.contacts USING btree (contact_user_id);


--
-- TOC entry 4997 (class 1259 OID 25123)
-- Name: idx_contacts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_status ON public.contacts USING btree (status);


--
-- TOC entry 4998 (class 1259 OID 25060)
-- Name: idx_contacts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_user_id ON public.contacts USING btree (user_id);


--
-- TOC entry 4955 (class 1259 OID 25119)
-- Name: idx_customer_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_user_id ON public.customer USING btree (user_id);


--
-- TOC entry 5008 (class 1259 OID 25116)
-- Name: idx_log_datetime; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_datetime ON public.log USING btree (log_datetime);


--
-- TOC entry 5009 (class 1259 OID 25124)
-- Name: idx_log_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_status ON public.log USING btree (status);


--
-- TOC entry 5010 (class 1259 OID 25115)
-- Name: idx_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_log_user_id ON public.log USING btree (user_id);


--
-- TOC entry 4956 (class 1259 OID 24882)
-- Name: idx_sme_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sme_user_id ON public.sme USING btree (user_id);


--
-- TOC entry 4983 (class 1259 OID 25122)
-- Name: idx_transactions_amount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_amount ON public.transactions USING btree (amount);


--
-- TOC entry 4984 (class 1259 OID 25031)
-- Name: idx_transactions_initiated_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_initiated_by_user_id ON public.transactions USING btree (initiated_by_user_id);


--
-- TOC entry 4985 (class 1259 OID 25029)
-- Name: idx_transactions_receiver_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_receiver_wallet_id ON public.transactions USING btree (receiver_wallet_id);


--
-- TOC entry 4986 (class 1259 OID 25028)
-- Name: idx_transactions_sender_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_sender_wallet_id ON public.transactions USING btree (sender_wallet_id);


--
-- TOC entry 4987 (class 1259 OID 25033)
-- Name: idx_transactions_transaction_datetime; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_transaction_datetime ON public.transactions USING btree (transaction_datetime);


--
-- TOC entry 4988 (class 1259 OID 25032)
-- Name: idx_transactions_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_type_status ON public.transactions USING btree (transaction_type_id, transaction_status_id);


--
-- TOC entry 4989 (class 1259 OID 25030)
-- Name: idx_transactions_user_account_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_account_id ON public.transactions USING btree (user_account_id);


--
-- TOC entry 4968 (class 1259 OID 24950)
-- Name: idx_user_account_details_bank_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_account_details_bank_id ON public.user_account_details USING btree (bank_id);


--
-- TOC entry 4969 (class 1259 OID 25121)
-- Name: idx_user_account_details_default_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_account_details_default_active ON public.user_account_details USING btree (is_default, is_active);


--
-- TOC entry 4970 (class 1259 OID 24949)
-- Name: idx_user_account_details_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_account_details_user_id ON public.user_account_details USING btree (user_id);


--
-- TOC entry 4946 (class 1259 OID 25118)
-- Name: idx_user_contact_info_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_contact_info_email ON public.user_contact_info USING btree (email);


--
-- TOC entry 5005 (class 1259 OID 25094)
-- Name: idx_user_role_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_role_role_id ON public.user_role USING btree (role_id);


--
-- TOC entry 4943 (class 1259 OID 25117)
-- Name: idx_users_fname_lname; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_fname_lname ON public.users USING btree (fname, lname);


--
-- TOC entry 4963 (class 1259 OID 25120)
-- Name: idx_wallet_balance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallet_balance ON public.wallet USING btree (balance);


--
-- TOC entry 4964 (class 1259 OID 24916)
-- Name: idx_wallet_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallet_status ON public.wallet USING btree (status);


--
-- TOC entry 4965 (class 1259 OID 24915)
-- Name: idx_wallet_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallet_user_id ON public.wallet USING btree (user_id);


--
-- TOC entry 5025 (class 2606 OID 25055)
-- Name: contacts fk_contact_contact_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT fk_contact_contact_user FOREIGN KEY (contact_user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5026 (class 2606 OID 25050)
-- Name: contacts fk_contact_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5014 (class 2606 OID 24854)
-- Name: customer fk_customer_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5029 (class 2606 OID 25110)
-- Name: log fk_log_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.log
    ADD CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5015 (class 2606 OID 24877)
-- Name: sme fk_sme_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sme
    ADD CONSTRAINT fk_sme_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5019 (class 2606 OID 25013)
-- Name: transactions fk_transaction_initiated_by_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_initiated_by_user FOREIGN KEY (initiated_by_user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5020 (class 2606 OID 25003)
-- Name: transactions fk_transaction_receiver_wallet; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_receiver_wallet FOREIGN KEY (receiver_wallet_id) REFERENCES public.wallet(wallet_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5021 (class 2606 OID 24998)
-- Name: transactions fk_transaction_sender_wallet; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_sender_wallet FOREIGN KEY (sender_wallet_id) REFERENCES public.wallet(wallet_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5022 (class 2606 OID 25023)
-- Name: transactions fk_transaction_status; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_status FOREIGN KEY (transaction_status_id) REFERENCES public.transaction_status(transaction_status_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5023 (class 2606 OID 25018)
-- Name: transactions fk_transaction_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_type FOREIGN KEY (transaction_type_id) REFERENCES public.transaction_type(transaction_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5024 (class 2606 OID 25008)
-- Name: transactions fk_transaction_user_account; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transaction_user_account FOREIGN KEY (user_account_id) REFERENCES public.user_account_details(user_account_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5017 (class 2606 OID 24944)
-- Name: user_account_details fk_user_account_bank; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_details
    ADD CONSTRAINT fk_user_account_bank FOREIGN KEY (bank_id) REFERENCES public.bank(bank_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5018 (class 2606 OID 24939)
-- Name: user_account_details fk_user_account_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_details
    ADD CONSTRAINT fk_user_account_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5013 (class 2606 OID 24837)
-- Name: user_contact_info fk_user_contact_info_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_info
    ADD CONSTRAINT fk_user_contact_info_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5027 (class 2606 OID 25089)
-- Name: user_role fk_user_role_role; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT fk_user_role_role FOREIGN KEY (role_id) REFERENCES public.role(role_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5028 (class 2606 OID 25084)
-- Name: user_role fk_user_role_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT fk_user_role_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5016 (class 2606 OID 24910)
-- Name: wallet fk_wallet_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


-- Completed on 2026-08-18 01:49:34

--
-- PostgreSQL database dump complete
--

\unrestrict eON4oQiifNOqdRyzu6nvGxS790PHxMDtw1s4XxeZ82MItMk2N9v8ZDLvA7GxFTW

