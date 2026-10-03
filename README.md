<div align="center">

# 💸 SpendWise

**An AI-powered expense tracker — track income, expenses, and budgets in real time.**

A full-stack application with a **Node.js + Express + PostgreSQL** REST API and a
**React + Vite** single-page frontend — JWT authentication, per-category budgets,
AI-generated daily insights, and a simulated bank connection with live updates.

</div>

---

## 📸 Screenshots

|                                     Dashboard                                      |                                        Transactions                                         |
| :--------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| ![Dashboard — balance, trend & category charts](docs/screenshots/02-dashboard.png) | ![Transactions — filterable list with CSV/PDF export](docs/screenshots/03-transactions.png) |
|                     **Budgets — live progress & spend alerts**                     |                       **AI Insights — ask questions about your data**                       |
|          ![Budgets — live progress bars](docs/screenshots/04-budgets.png)          |            ![AI Insights — conversational Q&A](docs/screenshots/05-insights.png)            |
|                 **Bank accounts — simulated bank, realtime sync**                  |                                         **Sign in**                                         |
|       ![Bank accounts — demo bank connection](docs/screenshots/06-bank.png)        |                          ![Sign in](docs/screenshots/01-login.png)                          |

## ✨ Features

**Core money management**

- 💵 **Transactions** — full CRUD with type, category, and date-range filters, plus **CSV & PDF export**
- 🗂 **Categories** — customizable names, icons, and colors
- 🎯 **Budgets** — per-category limits with daily / weekly / monthly / yearly periods and live progress
- 📊 **Dashboard** — net balance, monthly income-vs-expense trend, and spending-by-category charts

**Intelligence & automation**

- 🤖 **AI Insights** — a personalized daily summary and a conversational Q&A over your own data (Google Gemini), with a deterministic **rule-based fallback** when no API key is configured
- 🏦 **Bank connections (simulated)** — link a fictional bank account with OTP verification and watch transactions, balances, budgets, and insights update **in real time** via Server-Sent Events. Simulation only — never a real bank, credentials.
- 🔔 **Budget alerts** — warnings the moment a synced expense pushes a budget past its threshold

### Prerequisites

| Requirement | Version                  |
| ----------- | ------------------------ |
| Node.js     | 18+ (20 LTS recommended) |
| PostgreSQL  | 13+                      |
| npm         | ships with Node.js       |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your user name/AI-Powered-Expense-Tracker.git


```

##

.

## 🤝 Contributing

Contributions are welcome! If you'd like to improve SpendWise:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "Add some amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<div align="center">

**Built with Node.js, Express, PostgreSQL, and React** · Made with ❤️ and a lot of coffee

</div>
