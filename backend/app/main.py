from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, balances, categories, health, items, members, offset_rules, payments, reports, tickets

settings = get_settings()

app = FastAPI(title="Portuguese Drunk Sailors", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(members.router)
app.include_router(categories.router)
app.include_router(tickets.router)
app.include_router(items.router)
app.include_router(balances.router)
app.include_router(offset_rules.router)
app.include_router(payments.router)
app.include_router(reports.router)
