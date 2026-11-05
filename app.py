"""
Banking Transactions Analysis System - Backend
Built with Python Flask and SQLite.

This module provides the complete financial analytics and banking engine:
- Initializes the SQLite database (banking.db) with three relational tables.
- Implements comprehensive REST APIs for Customers, Accounts, Deposits, Withdrawals,
  Transaction History, Analytics / Charts, and Rule-Based Unusual Activity Alerts.
- Enforces strict data integrity with foreign keys, unique constraints, and balance checks.
- Uses parameterized SQL queries exclusively to prevent SQL injection.
- Formatted with Indian Rupees (₹) throughout.
"""

import sqlite3
import os
import random
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DATABASE = 'banking.db'


# ==========================================
# Database Connection & Initialization
# ==========================================

def get_db_connection():
    """
    Establishes and returns a connection to the SQLite database.
    - Sets row_factory to sqlite3.Row so columns can be accessed by name (e.g., row['balance']).
    - Enables foreign key constraint enforcement in SQLite.
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    # Foreign key constraints are disabled by default in SQLite; explicitly enable them:
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """
    Initializes the database schema by creating three relational tables if they do not exist:
    1. customers: Stores customer contact and identity details.
    2. accounts: Stores bank accounts linked to customers with a unique account number and balance.
    3. transactions: Stores every deposit and withdrawal event linked to an account.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Customers Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Accounts Table
    # - customer_id links to customers(id) via foreign key.
    # - account_number must be unique across all accounts.
    # - CHECK(balance >= 0) ensures balances never go negative at the database level.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_number TEXT UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            account_type TEXT NOT NULL DEFAULT 'Savings',
            balance REAL NOT NULL DEFAULT 0.0 CHECK(balance >= 0),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
    """)

    # 3. Transactions Table
    # - account_id links to accounts(id) via foreign key.
    # - transaction_type is restricted to 'Deposit' or 'Withdrawal'.
    # - CHECK(amount > 0) guarantees every transaction has a positive non-zero value.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Deposit', 'Withdrawal')),
            amount REAL NOT NULL CHECK(amount > 0),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


# Ensure database tables exist automatically on startup
init_db()


# ==========================================
# Helper Utilities
# ==========================================

def get_request_data():
    """
    Safely retrieves data from either JSON payloads or standard HTML form submissions.
    This allows endpoints to support both JavaScript fetch/axios and standard HTML forms.
    """
    if request.is_json:
        return request.get_json() or {}
    return request.form.to_dict()


def generate_account_number():
    """
    Generates a unique 10-character account number (e.g., 'ACC12345678').
    Checks against existing records to prevent collisions.
    """
    conn = get_db_connection()
    while True:
        num = f"ACC{random.randint(10000000, 99999999)}"
        existing = conn.execute(
            "SELECT id FROM accounts WHERE account_number = ?", (num,)
        ).fetchone()
        if not existing:
            conn.close()
            return num


# ==========================================
# Home & Core Dashboard API
# ==========================================

@app.route('/')
def home():
    """
    Route: Home / Dashboard Page
    If requested with format=json or an application/json Accept header, returns dashboard data.
    Otherwise renders index.html (or falls back to JSON if template is missing).
    """
    if request.args.get('format') == 'json' or request.headers.get('Accept') == 'application/json':
        return get_dashboard()

    try:
        return render_template('index.html')
    except Exception:
        return get_dashboard()


@app.route('/api/dashboard', methods=['GET'])
@app.route('/dashboard', methods=['GET'])
def get_dashboard():
    """
    Route: View Dashboard
    Calculates and returns aggregated analytical metrics from SQLite:
    - Total customer count
    - Total account count
    - Total bank balance across all accounts
    - Total deposit volume and count
    - Total withdrawal volume and count
    - List of recent transactions (joined with account and customer info)
    - List of all accounts with owner details
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Total customers
        cursor.execute("SELECT COUNT(*) AS total_customers FROM customers")
        total_customers = cursor.fetchone()['total_customers']

        # 2. Total accounts and cumulative balance
        cursor.execute("""
            SELECT COUNT(*) AS total_accounts, COALESCE(SUM(balance), 0.0) AS total_balance 
            FROM accounts
        """)
        account_stats = cursor.fetchone()
        total_accounts = account_stats['total_accounts']
        total_balance = round(float(account_stats['total_balance']), 2)

        # 3. Deposit statistics
        cursor.execute("""
            SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0.0) AS total 
            FROM transactions 
            WHERE transaction_type = 'Deposit'
        """)
        deposit_stats = cursor.fetchone()
        total_deposits = round(float(deposit_stats['total']), 2)
        total_deposit_count = deposit_stats['count']

        # 4. Withdrawal statistics
        cursor.execute("""
            SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0.0) AS total 
            FROM transactions 
            WHERE transaction_type = 'Withdrawal'
        """)
        withdrawal_stats = cursor.fetchone()
        total_withdrawals = round(float(withdrawal_stats['total']), 2)
        total_withdrawal_count = withdrawal_stats['count']

        # 5. Recent 10 transactions with related customer and account data
        cursor.execute("""
            SELECT 
                t.id,
                t.transaction_type,
                t.amount,
                t.timestamp,
                t.description,
                a.account_number,
                a.account_type,
                c.name AS customer_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN customers c ON a.customer_id = c.id
            ORDER BY t.id DESC
            LIMIT 10
        """)
        recent_transactions = [dict(row) for row in cursor.fetchall()]

        # 6. Overview of all accounts
        cursor.execute("""
            SELECT 
                a.id,
                a.account_number,
                a.account_type,
                a.balance,
                a.created_at,
                c.id AS customer_id,
                c.name AS customer_name,
                c.email AS customer_email
            FROM accounts a
            JOIN customers c ON a.customer_id = c.id
            ORDER BY a.id DESC
        """)
        accounts = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            'success': True,
            'summary': {
                'total_customers': total_customers,
                'total_accounts': total_accounts,
                'total_balance': total_balance,
                'total_deposits': total_deposits,
                'total_deposit_count': total_deposit_count,
                'total_withdrawals': total_withdrawals,
                'total_withdrawal_count': total_withdrawal_count
            },
            'recent_transactions': recent_transactions,
            'accounts': accounts
        }), 200

    except sqlite3.Error as e:
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# Financial Analytics & Charts API
# ==========================================

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """
    Route: Financial Analytics & Interactive Chart Feeds
    Aggregates real records for:
    1. Monthly deposit vs withdrawal comparison (for bar and line charts)
    2. Overall deposit vs withdrawal distribution (for doughnut charts)
    3. Account type distribution (by count and total balance)
    4. Top accounts by balance
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Monthly deposits and withdrawals comparison
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', timestamp) AS month,
                transaction_type,
                COALESCE(SUM(amount), 0.0) AS total_amount,
                COUNT(*) AS count
            FROM transactions
            GROUP BY month, transaction_type
            ORDER BY month ASC
        """)
        monthly_raw = cursor.fetchall()

        # Organize by month chronologically
        monthly_map = {}
        for row in monthly_raw:
            m = row['month']
            if not m:
                continue
            if m not in monthly_map:
                monthly_map[m] = {'month': m, 'deposits': 0.0, 'withdrawals': 0.0, 'deposit_count': 0, 'withdrawal_count': 0}
            if row['transaction_type'] == 'Deposit':
                monthly_map[m]['deposits'] = round(float(row['total_amount']), 2)
                monthly_map[m]['deposit_count'] = row['count']
            elif row['transaction_type'] == 'Withdrawal':
                monthly_map[m]['withdrawals'] = round(float(row['total_amount']), 2)
                monthly_map[m]['withdrawal_count'] = row['count']

        months = sorted(list(monthly_map.keys()))
        deposit_series = [monthly_map[m]['deposits'] for m in months]
        withdrawal_series = [monthly_map[m]['withdrawals'] for m in months]
        net_flow_series = [round(monthly_map[m]['deposits'] - monthly_map[m]['withdrawals'], 2) for m in months]
        deposit_count_series = [monthly_map[m]['deposit_count'] for m in months]
        withdrawal_count_series = [monthly_map[m]['withdrawal_count'] for m in months]

        # 2. Deposit vs. Withdrawal distribution
        cursor.execute("""
            SELECT 
                transaction_type,
                COALESCE(SUM(amount), 0.0) AS total_amount,
                COUNT(*) AS count
            FROM transactions
            GROUP BY transaction_type
        """)
        type_dist_raw = cursor.fetchall()
        deposit_total = 0.0
        withdrawal_total = 0.0
        deposit_count = 0
        withdrawal_count = 0

        for row in type_dist_raw:
            if row['transaction_type'] == 'Deposit':
                deposit_total = round(float(row['total_amount']), 2)
                deposit_count = row['count']
            elif row['transaction_type'] == 'Withdrawal':
                withdrawal_total = round(float(row['total_amount']), 2)
                withdrawal_count = row['count']

        total_volume = deposit_total + withdrawal_total
        deposit_pct = round((deposit_total / total_volume * 100), 1) if total_volume > 0 else 50.0
        withdrawal_pct = round((withdrawal_total / total_volume * 100), 1) if total_volume > 0 else 50.0

        # 3. Account Type Distribution
        cursor.execute("""
            SELECT 
                account_type,
                COUNT(*) AS count,
                COALESCE(SUM(balance), 0.0) AS total_balance
            FROM accounts
            GROUP BY account_type
            ORDER BY count DESC
        """)
        acc_type_rows = cursor.fetchall()
        acc_type_labels = [row['account_type'] for row in acc_type_rows]
        acc_type_counts = [row['count'] for row in acc_type_rows]
        acc_type_balances = [round(float(row['total_balance']), 2) for row in acc_type_rows]

        # 4. Top Accounts by Balance
        cursor.execute("""
            SELECT 
                a.account_number,
                a.account_type,
                a.balance,
                c.name AS customer_name
            FROM accounts a
            JOIN customers c ON a.customer_id = c.id
            ORDER BY a.balance DESC
            LIMIT 5
        """)
        top_accounts = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            'success': True,
            'monthly_comparison': {
                'months': months,
                'deposits': deposit_series,
                'withdrawals': withdrawal_series,
                'net_flow': net_flow_series,
                'deposit_counts': deposit_count_series,
                'withdrawal_counts': withdrawal_count_series
            },
            'distribution': {
                'deposit_total': deposit_total,
                'withdrawal_total': withdrawal_total,
                'deposit_count': deposit_count,
                'withdrawal_count': withdrawal_count,
                'deposit_percentage': deposit_pct,
                'withdrawal_percentage': withdrawal_pct
            },
            'account_types': {
                'labels': acc_type_labels,
                'counts': acc_type_counts,
                'balances': acc_type_balances
            },
            'top_accounts': top_accounts
        }), 200

    except sqlite3.Error as e:
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# Unusual Transaction Alerts API
# ==========================================

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """
    Route: Unusual Transaction Alerts
    Applies 4 clear, auditable risk detection rules on actual SQLite records:
    1. High-Value Transaction: Any single deposit or withdrawal >= ₹50,000.
    2. High Account Depletion: Any withdrawal that consumed >= 80% of account funds.
    3. Zero Balance Post-Withdrawal: Account drained completely to ₹0.00.
    4. Rapid Transaction Velocity: 3 or more transactions on the same account within 24 hours.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    alerts = []

    try:
        # Rule 1: High-Value Transactions (amount >= 50,000)
        cursor.execute("""
            SELECT 
                t.id,
                t.transaction_type,
                t.amount,
                t.timestamp,
                t.description,
                a.account_number,
                a.account_type,
                c.name AS customer_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN customers c ON a.customer_id = c.id
            WHERE t.amount >= 50000
            ORDER BY t.id DESC
            LIMIT 20
        """)
        for row in cursor.fetchall():
            alerts.append({
                'id': f"HVT-{row['id']}",
                'transaction_id': row['id'],
                'rule_name': 'High-Value Transaction',
                'severity': 'HIGH',
                'account_number': row['account_number'],
                'customer_name': row['customer_name'],
                'amount': row['amount'],
                'type': row['transaction_type'],
                'timestamp': row['timestamp'],
                'details': f"Single {row['transaction_type'].lower()} of ₹{row['amount']:,.2f} exceeds high-value threshold (₹50,000.00)."
            })

        # Rule 2: High Account Depletion (Withdrawal >= 80% of available funds at transaction time)
        # We estimate pre-withdrawal balance as current balance + withdrawal amount.
        cursor.execute("""
            SELECT 
                t.id,
                t.amount,
                t.timestamp,
                a.account_number,
                a.balance AS current_balance,
                c.name AS customer_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN customers c ON a.customer_id = c.id
            WHERE t.transaction_type = 'Withdrawal'
              AND (t.amount / (a.balance + t.amount)) >= 0.80
              AND t.amount >= 1000
            ORDER BY t.id DESC
            LIMIT 20
        """)
        for row in cursor.fetchall():
            pre_bal = row['current_balance'] + row['amount']
            depletion_pct = round((row['amount'] / pre_bal) * 100, 1) if pre_bal > 0 else 100.0
            alerts.append({
                'id': f"DEP-{row['id']}",
                'transaction_id': row['id'],
                'rule_name': 'High Account Depletion',
                'severity': 'WARNING',
                'account_number': row['account_number'],
                'customer_name': row['customer_name'],
                'amount': row['amount'],
                'type': 'Withdrawal',
                'timestamp': row['timestamp'],
                'details': f"Withdrawal of ₹{row['amount']:,.2f} depleted {depletion_pct}% of total account funds."
            })

        # Rule 3: Zero Balance Post-Withdrawal
        cursor.execute("""
            SELECT 
                a.account_number,
                a.balance,
                c.name AS customer_name,
                t.id AS transaction_id,
                t.amount,
                t.timestamp
            FROM accounts a
            JOIN customers c ON a.customer_id = c.id
            JOIN transactions t ON t.account_id = a.id
            WHERE a.balance = 0.0
              AND t.transaction_type = 'Withdrawal'
            ORDER BY t.id DESC
            LIMIT 15
        """)
        for row in cursor.fetchall():
            alerts.append({
                'id': f"ZRO-{row['transaction_id']}",
                'transaction_id': row['transaction_id'],
                'rule_name': 'Zero Balance Drain',
                'severity': 'CRITICAL',
                'account_number': row['account_number'],
                'customer_name': row['customer_name'],
                'amount': row['amount'],
                'type': 'Withdrawal',
                'timestamp': row['timestamp'],
                'details': f"Account has been completely drained to ₹0.00 following withdrawal of ₹{row['amount']:,.2f}."
            })

        # Rule 4: Rapid Transaction Velocity (3+ transactions within last 24 hours)
        cursor.execute("""
            SELECT 
                a.account_number,
                c.name AS customer_name,
                COUNT(t.id) AS txn_count,
                MAX(t.timestamp) AS last_txn_time
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN customers c ON a.customer_id = c.id
            WHERE t.timestamp >= datetime('now', '-1 day')
            GROUP BY a.id
            HAVING txn_count >= 3
            ORDER BY txn_count DESC
            LIMIT 10
        """)
        for row in cursor.fetchall():
            alerts.append({
                'id': f"VEL-{row['account_number']}",
                'transaction_id': None,
                'rule_name': 'High Velocity Activity',
                'severity': 'MEDIUM',
                'account_number': row['account_number'],
                'customer_name': row['customer_name'],
                'amount': None,
                'type': 'Velocity',
                'timestamp': row['last_txn_time'],
                'details': f"Unusual frequency: {row['txn_count']} transactions recorded within the past 24 hours."
            })

        return jsonify({
            'success': True,
            'count': len(alerts),
            'alerts': alerts
        }), 200

    except sqlite3.Error as e:
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# Customer Management APIs (CRUD)
# ==========================================

@app.route('/api/customers', methods=['POST', 'GET'])
@app.route('/customers', methods=['POST', 'GET'])
def handle_customers():
    """
    Route: Add Customers (POST) & List Customers (GET)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        try:
            # Query customers along with their account count and total balance
            cursor.execute("""
                SELECT 
                    c.id,
                    c.name,
                    c.email,
                    c.phone,
                    c.created_at,
                    COUNT(a.id) AS account_count,
                    COALESCE(SUM(a.balance), 0.0) AS total_balance
                FROM customers c
                LEFT JOIN accounts a ON a.customer_id = c.id
                GROUP BY c.id
                ORDER BY c.id DESC
            """)
            customers = [dict(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'customers': customers}), 200
        except sqlite3.Error as e:
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()

    # POST: Register a new customer
    data = get_request_data()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()

    if not name:
        conn.close()
        return jsonify({'success': False, 'error': 'Customer name is required.'}), 400

    if not email:
        conn.close()
        return jsonify({'success': False, 'error': 'Customer email is required.'}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        conn.close()
        return jsonify({'success': False, 'error': 'Invalid email address format.'}), 400

    try:
        cursor.execute(
            "INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)",
            (name, email, phone)
        )
        conn.commit()
        customer_id = cursor.lastrowid

        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        new_customer = dict(cursor.fetchone())

        return jsonify({
            'success': True,
            'message': 'Customer registered successfully.',
            'customer': new_customer
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'A customer with this email already exists.'}), 409
    except sqlite3.Error as e:
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
def manage_customer(customer_id):
    """
    CRUD: Read One (GET), Update (PUT), Delete (DELETE) Customer
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify existence
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    customer = cursor.fetchone()
    if not customer:
        conn.close()
        return jsonify({'success': False, 'error': f"Customer with ID {customer_id} does not exist."}), 404

    # GET: Single customer details with accounts
    if request.method == 'GET':
        cursor.execute("SELECT * FROM accounts WHERE customer_id = ? ORDER BY id DESC", (customer_id,))
        accounts = [dict(row) for row in cursor.fetchall()]
        customer_data = dict(customer)
        customer_data['accounts'] = accounts
        conn.close()
        return jsonify({'success': True, 'customer': customer_data}), 200

    # PUT: Update customer details
    if request.method == 'PUT':
        data = get_request_data()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()

        if not name:
            conn.close()
            return jsonify({'success': False, 'error': 'Customer name is required.'}), 400

        if not email:
            conn.close()
            return jsonify({'success': False, 'error': 'Customer email is required.'}), 400

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            conn.close()
            return jsonify({'success': False, 'error': 'Invalid email address format.'}), 400

        # Check for email collision with other customers
        cursor.execute("SELECT id FROM customers WHERE email = ? AND id != ?", (email, customer_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Another customer already uses this email address.'}), 409

        try:
            cursor.execute(
                "UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?",
                (name, email, phone, customer_id)
            )
            conn.commit()

            cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
            updated_customer = dict(cursor.fetchone())

            return jsonify({
                'success': True,
                'message': 'Customer details updated successfully.',
                'customer': updated_customer
            }), 200
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()

    # DELETE: Delete customer (cascades to accounts and transactions)
    if request.method == 'DELETE':
        try:
            # Count affected accounts
            cursor.execute("SELECT COUNT(*) AS count FROM accounts WHERE customer_id = ?", (customer_id,))
            acc_count = cursor.fetchone()['count']

            cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
            conn.commit()

            return jsonify({
                'success': True,
                'message': f"Customer '{customer['name']}' and {acc_count} linked account(s) deleted successfully."
            }), 200
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()


# ==========================================
# Account Management APIs (CRUD)
# ==========================================

@app.route('/api/accounts', methods=['POST', 'GET'])
@app.route('/accounts', methods=['POST', 'GET'])
def handle_accounts():
    """
    Route: Create Accounts (POST) & List Accounts (GET)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        try:
            cursor.execute("""
                SELECT 
                    a.id,
                    a.account_number,
                    a.account_type,
                    a.balance,
                    a.created_at,
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    COUNT(t.id) AS transaction_count
                FROM accounts a
                JOIN customers c ON a.customer_id = c.id
                LEFT JOIN transactions t ON t.account_id = a.id
                GROUP BY a.id
                ORDER BY a.id DESC
            """)
            accounts = [dict(row) for row in cursor.fetchall()]
            return jsonify({'success': True, 'accounts': accounts}), 200
        except sqlite3.Error as e:
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()

    # POST: Open new account
    data = get_request_data()
    customer_id = data.get('customer_id')
    account_type = data.get('account_type', 'Savings').strip() or 'Savings'
    account_number = data.get('account_number', '').strip()
    raw_deposit = data.get('initial_deposit', 0.0)

    if not customer_id:
        conn.close()
        return jsonify({'success': False, 'error': 'Customer ID is required.'}), 400

    try:
        customer_id = int(customer_id)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'success': False, 'error': 'Customer ID must be a valid integer.'}), 400

    cursor.execute("SELECT id, name FROM customers WHERE id = ?", (customer_id,))
    customer = cursor.fetchone()
    if not customer:
        conn.close()
        return jsonify({'success': False, 'error': f"Customer with ID {customer_id} does not exist."}), 404

    try:
        initial_deposit = float(raw_deposit)
        if initial_deposit < 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Initial deposit cannot be negative.'}), 400
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'success': False, 'error': 'Initial deposit must be a valid number.'}), 400

    if not account_number:
        account_number = generate_account_number()
    else:
        cursor.execute("SELECT id FROM accounts WHERE account_number = ?", (account_number,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f"Account number '{account_number}' already exists."}), 409

    try:
        cursor.execute(
            """
            INSERT INTO accounts (account_number, customer_id, account_type, balance)
            VALUES (?, ?, ?, ?)
            """,
            (account_number, customer_id, account_type, initial_deposit)
        )
        account_id = cursor.lastrowid

        if initial_deposit > 0:
            cursor.execute(
                """
                INSERT INTO transactions (account_id, transaction_type, amount, description)
                VALUES (?, 'Deposit', ?, ?)
                """,
                (account_id, initial_deposit, 'Initial account opening deposit')
            )

        conn.commit()

        cursor.execute("""
            SELECT 
                a.id, a.account_number, a.account_type, a.balance, a.created_at,
                c.id AS customer_id, c.name AS customer_name
            FROM accounts a
            JOIN customers c ON a.customer_id = c.id
            WHERE a.id = ?
        """, (account_id,))
        new_account = dict(cursor.fetchone())

        return jsonify({
            'success': True,
            'message': 'Account created successfully.',
            'account': new_account
        }), 201

    except sqlite3.IntegrityError as e:
        conn.rollback()
        return jsonify({'success': False, 'error': f"Integrity error: {str(e)}"}), 409
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


@app.route('/api/accounts/<int:account_id>', methods=['GET', 'PUT', 'DELETE'])
def manage_account(account_id):
    """
    CRUD: Read One (GET), Update Account Type (PUT), Delete Account (DELETE)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.*, c.name AS customer_name, c.email AS customer_email
        FROM accounts a
        JOIN customers c ON a.customer_id = c.id
        WHERE a.id = ?
    """, (account_id,))
    account = cursor.fetchone()

    if not account:
        conn.close()
        return jsonify({'success': False, 'error': f"Account with ID {account_id} not found."}), 404

    # GET: Single account
    if request.method == 'GET':
        cursor.execute("""
            SELECT * FROM transactions WHERE account_id = ? ORDER BY id DESC LIMIT 50
        """, (account_id,))
        txns = [dict(row) for row in cursor.fetchall()]
        data = dict(account)
        data['transactions'] = txns
        conn.close()
        return jsonify({'success': True, 'account': data}), 200

    # PUT: Update account type
    if request.method == 'PUT':
        payload = get_request_data()
        account_type = payload.get('account_type', '').strip()
        if not account_type:
            conn.close()
            return jsonify({'success': False, 'error': 'Account type is required.'}), 400

        try:
            cursor.execute("UPDATE accounts SET account_type = ? WHERE id = ?", (account_type, account_id))
            conn.commit()

            cursor.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
            updated_acc = dict(cursor.fetchone())

            return jsonify({
                'success': True,
                'message': f"Account type updated to {account_type}.",
                'account': updated_acc
            }), 200
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()

    # DELETE: Delete account (and related transactions)
    if request.method == 'DELETE':
        try:
            acc_num = account['account_number']
            bal = float(account['balance'])

            cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
            conn.commit()

            return jsonify({
                'success': True,
                'message': f"Account {acc_num} (closed balance ₹{bal:,.2f}) deleted successfully."
            }), 200
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
        finally:
            conn.close()


# ==========================================
# Deposit & Withdraw Money APIs
# ==========================================

@app.route('/api/deposit', methods=['POST'])
@app.route('/deposit', methods=['POST'])
def deposit():
    """
    Route: Deposit Money
    Credits an account and logs a Deposit transaction in SQLite.
    """
    data = get_request_data()
    account_identifier = data.get('account_number') or data.get('account_id')
    raw_amount = data.get('amount')
    description = data.get('description', 'Cash deposit').strip() or 'Cash deposit'

    if not account_identifier:
        return jsonify({'success': False, 'error': 'Account number or ID is required.'}), 400

    if raw_amount is None:
        return jsonify({'success': False, 'error': 'Deposit amount is required.'}), 400

    try:
        amount = float(raw_amount)
        if amount <= 0:
            return jsonify({'success': False, 'error': 'Deposit amount must be strictly greater than ₹0.00.'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Deposit amount must be a valid number.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT * FROM accounts WHERE account_number = ? OR id = ?",
            (str(account_identifier), str(account_identifier))
        )
        account = cursor.fetchone()

        if not account:
            return jsonify({'success': False, 'error': f"Account '{account_identifier}' not found."}), 404

        account_id = account['id']
        current_balance = float(account['balance'])
        new_balance = round(current_balance + amount, 2)

        cursor.execute(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?",
            (amount, account_id)
        )

        cursor.execute(
            """
            INSERT INTO transactions (account_id, transaction_type, amount, description)
            VALUES (?, 'Deposit', ?, ?)
            """,
            (account_id, amount, description)
        )

        conn.commit()

        return jsonify({
            'success': True,
            'message': f"Successfully deposited ₹{amount:,.2f}.",
            'account_number': account['account_number'],
            'previous_balance': current_balance,
            'new_balance': new_balance,
            'deposited_amount': amount
        }), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


@app.route('/api/withdraw', methods=['POST'])
@app.route('/withdraw', methods=['POST'])
def withdraw():
    """
    Route: Withdraw Money
    Debits an account and rejects withdrawal if balance is insufficient.
    """
    data = get_request_data()
    account_identifier = data.get('account_number') or data.get('account_id')
    raw_amount = data.get('amount')
    description = data.get('description', 'Cash withdrawal').strip() or 'Cash withdrawal'

    if not account_identifier:
        return jsonify({'success': False, 'error': 'Account number or ID is required.'}), 400

    if raw_amount is None:
        return jsonify({'success': False, 'error': 'Withdrawal amount is required.'}), 400

    try:
        amount = float(raw_amount)
        if amount <= 0:
            return jsonify({'success': False, 'error': 'Withdrawal amount must be strictly greater than ₹0.00.'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Withdrawal amount must be a valid number.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT * FROM accounts WHERE account_number = ? OR id = ?",
            (str(account_identifier), str(account_identifier))
        )
        account = cursor.fetchone()

        if not account:
            return jsonify({'success': False, 'error': f"Account '{account_identifier}' not found."}), 404

        account_id = account['id']
        current_balance = float(account['balance'])

        # REJECT INSUFFICIENT BALANCE
        if current_balance < amount:
            return jsonify({
                'success': False,
                'error': f"Insufficient balance. Current balance is ₹{current_balance:,.2f}, but requested withdrawal is ₹{amount:,.2f}."
            }), 400

        new_balance = round(current_balance - amount, 2)

        cursor.execute(
            "UPDATE accounts SET balance = balance - ? WHERE id = ?",
            (amount, account_id)
        )

        cursor.execute(
            """
            INSERT INTO transactions (account_id, transaction_type, amount, description)
            VALUES (?, 'Withdrawal', ?, ?)
            """,
            (account_id, amount, description)
        )

        conn.commit()

        return jsonify({
            'success': True,
            'message': f"Successfully withdrew ₹{amount:,.2f}.",
            'account_number': account['account_number'],
            'previous_balance': current_balance,
            'new_balance': new_balance,
            'withdrawn_amount': amount
        }), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# Transaction History & Management APIs
# ==========================================

@app.route('/api/transactions', methods=['GET'])
@app.route('/transactions', methods=['GET'])
@app.route('/api/transactions/<account_number>', methods=['GET'])
def get_transactions(account_number=None):
    """
    Route: Searchable and Filterable Transaction History
    Supports filtering by:
    - account_number
    - type ('Deposit' or 'Withdrawal')
    - start_date & end_date ('YYYY-MM-DD')
    - min_amount & max_amount
    - search query (searches customer name, account number, description)
    - limit
    """
    acc_num = account_number or request.args.get('account_number')
    txn_type = request.args.get('type')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    min_amount = request.args.get('min_amount')
    max_amount = request.args.get('max_amount')
    search = request.args.get('search', '').strip()
    limit = request.args.get('limit', 200)

    try:
        limit = int(limit)
    except (ValueError, TypeError):
        limit = 200

    query = """
        SELECT 
            t.id,
            t.transaction_type,
            t.amount,
            t.timestamp,
            t.description,
            a.account_number,
            a.account_type,
            c.name AS customer_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        JOIN customers c ON a.customer_id = c.id
        WHERE 1=1
    """
    params = []

    if acc_num and acc_num != 'ALL':
        query += " AND (a.account_number = ? OR a.id = ?)"
        params.extend([str(acc_num), str(acc_num)])

    if txn_type and txn_type != 'ALL':
        query += " AND t.transaction_type = ?"
        params.append(txn_type)

    if start_date:
        query += " AND date(t.timestamp) >= date(?)"
        params.append(start_date)

    if end_date:
        query += " AND date(t.timestamp) <= date(?)"
        params.append(end_date)

    if min_amount:
        try:
            query += " AND t.amount >= ?"
            params.append(float(min_amount))
        except ValueError:
            pass

    if max_amount:
        try:
            query += " AND t.amount <= ?"
            params.append(float(max_amount))
        except ValueError:
            pass

    if search:
        query += " AND (c.name LIKE ? OR a.account_number LIKE ? OR t.description LIKE ?)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])

    query += " ORDER BY t.id DESC LIMIT ?"
    params.append(limit)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query, params)
        transactions = [dict(row) for row in cursor.fetchall()]

        return jsonify({
            'success': True,
            'count': len(transactions),
            'account_filter': acc_num,
            'transactions': transactions
        }), 200

    except sqlite3.Error as e:
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """
    Route: Reversal / Deletion of a Transaction
    Safely adjusts account balance and removes transaction record:
    - Reversing a Deposit: Decreases balance (checks that account won't go negative).
    - Reversing a Withdrawal: Refunds the amount back to the account.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT t.*, a.balance, a.account_number 
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ?
        """, (transaction_id,))
        txn = cursor.fetchone()

        if not txn:
            return jsonify({'success': False, 'error': f"Transaction #{transaction_id} not found."}), 404

        account_id = txn['account_id']
        current_balance = float(txn['balance'])
        amount = float(txn['amount'])
        txn_type = txn['transaction_type']

        if txn_type == 'Deposit':
            if current_balance < amount:
                return jsonify({
                    'success': False,
                    'error': f"Cannot reverse deposit: account balance (₹{current_balance:,.2f}) is less than deposit amount (₹{amount:,.2f})."
                }), 400
            cursor.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", (amount, account_id))
        elif txn_type == 'Withdrawal':
            cursor.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (amount, account_id))

        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()

        return jsonify({
            'success': True,
            'message': f"Transaction #{transaction_id} ({txn_type} of ₹{amount:,.2f}) successfully reversed and deleted."
        }), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'success': False, 'error': f"Database error: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# Application Entry Point
# ==========================================

if __name__ == '__main__':
    init_db()
    print("Banking Transactions Analysis System Backend is running")
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=False
    )
