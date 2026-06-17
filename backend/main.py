from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base, SessionLocal
from routers import products, customers, orders, system, auth
from apscheduler.schedulers.background import BackgroundScheduler
import system_service
import os
import time
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("omnistock")

from database import engine, Base, SessionLocal
from routers import products, customers, orders, system, auth
from apscheduler.schedulers.background import BackgroundScheduler
import system_service
import models

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="PulseStock Enterprise API")

# --- Centralized Error Handling ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "An internal server error occurred.", "status_code": 500}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"error": True, "message": "Validation Error", "details": errors, "status_code": 422}
    )

# --- Request Logging Middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - {process_time:.2f}ms")
    return response

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/products", tags=["Products"])
app.include_router(customers.router, prefix="/customers", tags=["Customers"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(system.router, prefix="/system", tags=["System"])

# --- Background Orchestration ---
scheduler = BackgroundScheduler()
scheduler.add_job(system_service.run_inventory_integrity_check, 'interval', minutes=1)
scheduler.start()

# --- Single Deployable Surface ---
# In a production environment, we serve the built frontend from the same process
if os.path.exists("../frontend/dist"):
    app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")

@app.get("/api/status")
def read_root():
    return {
        "app": "PulseStock Enterprise",
        "version": "1.0.0-PROD",
        "engine": "FastAPI + SQLAlchemy",
        "reliability": "Deterministic Orchestration Active"
    }