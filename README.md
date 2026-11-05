# Banking Transactions Analysis System

A web-based banking transaction management and analytics application developed using Python, Flask, SQLite, HTML, CSS, and JavaScript.

**Live Demo:** https://banking-transactions-analysis.onrender.com/

**GitHub Repository:** https://github.com/psm16062008-prog/Banking-Transactions-Analysis

---

## 1. Project Overview

The Banking Transactions Analysis System is an academic web application designed to manage simulated banking activities and analyze transaction records through an interactive dashboard.

It provides customer management, account management, deposits, withdrawals, transaction history, financial analytics, and rule-based unusual transaction alerts.

The application demonstrates backend development, database operations, API integration, and data visualization.

**Note:** This is an academic simulation. It is not connected to real banking services or payment gateways.

## 2. Objectives

- Develop a centralized banking transaction management system.
- Maintain customer and account information.
- Record and manage deposit and withdrawal operations.
- Maintain accurate account balances.
- Analyze transaction activities through visual dashboards.
- Identify unusual transaction patterns using predefined rules.

## 3. Scope of the Project

The system covers:

- Customer and account management.
- Deposit and withdrawal processing.
- Transaction recording and history.
- Account balance tracking.
- Financial summaries and charts.
- Rule-based transaction alerts.

The system is intended for academic demonstration and testing with simulated data.

## 4. Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| Flask | Web framework and REST APIs |
| SQLite | Relational database |
| HTML5 | Frontend structure |
| CSS3 | Interface styling |
| JavaScript | Frontend functionality |
| Chart.js | Data visualization |
| Gunicorn | Production server |
| GitHub | Version control |
| Render | Cloud hosting |

## 5. System Architecture

The application follows a client-server architecture.

```text
             USER
               |
               v
       FRONTEND INTERFACE
        HTML / CSS / JS
               |
               v
          FLASK SERVER
          (Python)
               |
       -----------------
       |       |       |
       v       v       v
    Customer Account Transaction
     API      API       API
       |       |       |
       -----------------
               |
               v
          SQLITE DATABASE
               |
               v
       ANALYTICS & ALERTS
               |
               v
        DASHBOARD CHARTS
```

### Architecture Components

- **Frontend:** Provides the dashboard and user interaction.
- **Backend:** Processes requests and implements banking business logic.
- **Database:** Stores customers, accounts, and transaction records.
- **Analytics:** Generates transaction summaries and chart data.
- **Alerts:** Identifies potentially unusual transaction patterns.

## 6. Database Design

The application uses SQLite for relational data storage.

### Main Tables

| Table | Description |
|---|---|
| Customers | Stores customer information |
| Accounts | Stores account details and balances |
| Transactions | Stores deposit and withdrawal records |

### Database Operations

- Customer record management.
- Account creation and balance updates.
- Deposit and withdrawal recording.
- Transaction history retrieval.
- Transaction analysis.

The database is initialized by the Flask application.

## 7. API Documentation

The Flask backend provides API endpoints for application operations.

Main API categories include:

| Category | Functionality |
|---|---|
| Customers | Create and retrieve customer records |
| Accounts | Create and retrieve accounts |
| Deposits | Process deposit transactions |
| Withdrawals | Process withdrawal transactions |
| Transactions | Retrieve transaction history |
| Dashboard | Retrieve summary information |
| Analytics | Retrieve financial analysis data |
| Alerts | Retrieve unusual transaction alerts |

API requests and responses use JSON where applicable.

For exact endpoint paths and request parameters, refer to the route definitions in `app.py`.

## 8. Key Functional Requirements

### Customer Management
- Add customer information.
- Retrieve customer records.

### Account Management
- Create bank accounts.
- View account balances.

### Deposit Processing
- Accept valid deposit requests.
- Update account balances.
- Record deposit transactions.

### Withdrawal Processing
- Validate withdrawal requests.
- Reject withdrawals exceeding available balances.
- Update balances after successful withdrawals.

### Transaction History
- Maintain transaction records.
- Retrieve transaction details.
- Filter transactions by account where supported.

### Analytics
- Generate dashboard summaries.
- Display transaction information through charts.

### Unusual Transaction Alerts
- Apply predefined rules to identify unusual patterns.
- Flag transactions for review without automatically declaring fraud.

## 9. Acceptance Criteria

The application meets its main functional requirements when:

- Customers can be created and retrieved.
- Accounts can be created and displayed.
- Deposits correctly update account balances.
- Withdrawals are rejected when the available balance is insufficient.
- Successful transactions are recorded.
- Transaction history displays available records.
- Dashboard analytics display transaction information.
- Unusual transaction patterns can be flagged.
- The deployed application is accessible through its public URL.

## 10. Installation and Quick Start

### Prerequisites

- Python 3
- Git
- Visual Studio Code or another code editor

### Step 1: Clone the Repository

```bash
git clone https://github.com/psm16062008-prog/Banking-Transactions-Analysis.git
```

### Step 2: Navigate to the Project

```bash
cd Banking-Transactions-Analysis
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Start the Application

```bash
python app.py
```

### Step 5: Open the Application

Visit:

```text
http://127.0.0.1:5000
```

## 11. Python Backend Integration

The backend is implemented using Flask.

Example of making a request to the running local application:

```python
import requests

url = "http://127.0.0.1:5000/api/accounts"

response = requests.get(url)

print(response.status_code)
print(response.json())
```

This example demonstrates how a Python client can communicate with an API endpoint. The exact response depends on the available account records.

## 12. Project Structure

```text
Banking-Transactions-Analysis/
│
├── app.py
├── requirements.txt
├── .gitignore
│
├── templates/
│   └── index.html
│
└── static/
    ├── style.css
    └── script.js
```

### File Descriptions

- `app.py` – Flask backend, database initialization, and API routes.
- `requirements.txt` – Python dependencies.
- `.gitignore` – Files excluded from Git tracking.
- `templates/index.html` – Main application interface.
- `static/style.css` – Frontend styling.
- `static/script.js` – Frontend logic and API communication.

## 13. Deployment

The application is deployed using Render.

**Hosting Platform:** Render

**Application Type:** Python Web Service

**Production Server:** Gunicorn

**Live Application:**

https://banking-transactions-analysis.onrender.com/

**Source Code:**

https://github.com/psm16062008-prog/Banking-Transactions-Analysis

The application uses the deployment environment's assigned port.

## 14. Testing and Validation

The main functional checks include:

- Customer creation.
- Account creation.
- Deposit processing.
- Withdrawal validation.
- Insufficient
