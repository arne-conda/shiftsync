import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import employer, salary_types, process

app = FastAPI(title="ShiftSync API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employer.router, prefix="/api")
app.include_router(salary_types.router, prefix="/api")
app.include_router(process.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
