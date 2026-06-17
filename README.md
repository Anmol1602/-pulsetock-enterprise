# PulseStock Enterprise 📦

**PulseStock Enterprise** is a high-performance, full-stack inventory management platform designed for deterministic reliability and scale. Built with **FastAPI** and **React (Vite)**, it provides real-time visibility into stock levels, order lifecycles, and system-wide financial integrity.

---

## 🏗️ Architecture Overview

The system follows a **decoupled service-oriented architecture**, containerized for consistent deployment across development and production environments.

### 🔹 Backend (The "Orchestrator")
- **Framework:** FastAPI (Python 3.11)
- **Database:** PostgreSQL with SQLAlchemy (Asynchronous-ready)
- **Security:** JWT-based stateless authentication with `passlib` (Bcrypt)
- **Reliability Layer:** A background orchestration service that runs periodic "Integrity Checks" to reconcile inventory counts and verify order financial consistency.
- **API Design:** RESTful principles with automated OpenAPI documentation (Swagger).

### 🔹 Frontend (The "Dashboard")
- **Framework:** React 19 + TypeScript + Vite
- **State Management:** Functional components with Hooks (`useEffect`, `useState`)
- **Authentication:** Dual-provider support (Custom Email/Password & Google Sign-In via OAuth2)
- **UI/UX:** Modern, full-width responsive layout using CSS Variables for theme consistency.

### 🔹 Infrastructure
- **Containerization:** Docker & Docker Compose
- **Dev Workflow:** Automated hot-reloading for both Python (Uvicorn) and React (Vite via polling) ensures instant feedback during development.

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Google Cloud Client ID (Optional, for Google Sign-In)

### Installation
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Anmol1602/-pulsetock-enterprise.git
    cd -pulsetock-enterprise
    ```

2.  **Environment Setup (Optional):**
    If you wish to use Google Sign-In, set your Client ID:
    ```bash
    # Windows (PowerShell)
    $env:GOOGLE_CLIENT_ID = "your-client-id"
    # Linux/Mac
    export GOOGLE_CLIENT_ID="your-client-id"
    ```

3.  **Deploy Services:**
    ```bash
    docker-compose up --build
    ```

4.  **Access the Platform:**
    - **Frontend:** [http://localhost:5173](http://localhost:5173)
    - **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Key Features & Engineering Decisions

### 1. Deterministic Integrity Checks
Unlike standard CRUD apps, PulseStock features a specialized `system_service`. It automatically detects "silent failures" where a database record might not match the computed sum of its parts (e.g., an Order total mismatching its OrderItems). These are logged as `FAILURE` events in the audit trail.

### 2. Industry-Standard Security
The platform implements a stateless JWT flow. Passwords are never stored in plain text (Bcrypt hashing), and Google Sign-In is integrated via a secure ID Token verification flow on the backend.

### 3. Unified Seeding Engine
To facilitate rapid testing and team onboarding, we've implemented an in-app **"Seed Database"** trigger. This populates the entire relational graph (Users -> Products -> Customers -> Orders -> Items) with one click.

---

## 💎 Interview Q&A (Technical Deep Dive)

**Q: Why use FastAPI over Django/Flask?**  
*A: FastAPI provides native support for asynchronous programming and Pydantic-based data validation, which results in faster execution and significantly fewer runtime errors due to strict type-checking.*

**Q: How do you handle database race conditions during order placement?**  
*A: The system uses SQLAlchemy's transaction management (`db.commit()`). In a high-concurrency scenario, we would implement `SELECT FOR UPDATE` (Pessimistic Locking) on product rows to prevent overselling inventory.*

**Q: How is the React app optimized for production?**  
*A: We use Vite for ESM-based fast module replacement in dev and highly optimized Rollup-based bundling for production, ensuring minimal initial load times.*

**Q: How does the system handle horizontal scaling?**  
*A: Since the auth is stateless (JWT) and the system is containerized, we can scale the backend horizontally using a load balancer without needing session affinity (sticky sessions).*

---

## 👥 Contributors
- **Project Architect/Lead:** [Anmol](https://github.com/Anmol1607)

---

*This project was developed with a focus on clean code, automated testing, and developer productivity.*
