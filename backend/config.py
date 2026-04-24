"""
Configuration and constants for ATS Matcher Backend
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration (PostgreSQL)
# DATABASE_URL = os.getenv(
#     "DATABASE_URL",
#     "postgresql://postgres:password@localhost:5432/ats_matcher"
# )

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # "atsmatcherbackend-db.cjmke68s0ef0.eu-west-2.rds.amazonaws.com"
    "postgresql://atsmatcher:Gunners101@atsmatcherbackend-db.cjmke68s0ef0.eu-west-2.rds.amazonaws.com:5432/atsmatcher"
)

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change-in-production')

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Payment Configuration
PAYSTACK_SECRET_KEY = os.getenv('PAYSTACK_SECRET_KEY')
PAYSTACK_PK_KEY = os.getenv('PAYSTACK_PK_KEY')
PAYSTACK_BASE_URL = 'https://api.paystack.co'
PAYSTACK_CALLBACK_URL = os.getenv('PAYSTACK_CALLBACK_URL', 'http://localhost:5173/matcher')

# PayPal Configuration
PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID')
PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET')
PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'

# Usage Limits
USAGE_LIMITS = {
    'free': 1,
    'premium': 10
}

# Subscription Pricing
SUBSCRIPTION_PRICES = {
    'monthly': {'paystack': 1500000, 'paypal': 1500},  # 15000 NGN for Paystack, 15 USD for PayPal
    'yearly': {'paystack': 18000000, 'paypal': 18000}   # 180000 NGN for Paystack, 180 USD for PayPal
}

# Saved Resume Limits
MAX_SAVED_RESUMES = {
    'free': 1,
    'premium': 3
}

# Batch Processing Limits
MAX_BATCH_RESUMES = 10
