"""
Configuration and constants for ATS Matcher Backend
"""

import os
from dotenv import load_dotenv

load_dotenv(override=True)


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not set in environment")


# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    raise Exception("JWT_SECRET_KEY not set")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Paystack Payment Configuration
PAYSTACK_SECRET_KEY = os.getenv('PAYSTACK_SECRET_KEY')
PAYSTACK_PK_KEY = os.getenv('PAYSTACK_PK_KEY')
PAYSTACK_BASE_URL = 'https://api.paystack.co'
PAYSTACK_CALLBACK_URL = os.getenv('PAYSTACK_CALLBACK_URL', 'http://localhost:5173/matcher')

# PayPal Configuration
PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID')
PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET')
PAYPAL_BASE_URL = os.getenv('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com')

# ---------------------------------------------------------------------------
# SUBSCRIPTION TIERS
# ---------------------------------------------------------------------------
# free    — 1 AI action/day, no recruiter access
# premium — 10 AI actions/day, recruiter access (batch match, sessions)
# pro     — 100 AI actions/day, full recruiter access + all premium features
#
# Pricing rationale (Pro tier):
#   LLM cost at full usage (100 analyses/day × 30 days):
#     ~3,000 analyses × $0.006 avg = ~$18/month LLM cost
#   Target price: ₦100,000/month (~$60 at ₦1,600/$1)
#   Gross margin at full usage: ~$42/month (~70%) — healthy SaaS margin
#   Yearly: ₦1,000,000 (≈16.7% discount) / $600 (same)
# ---------------------------------------------------------------------------

# Daily AI action limits per subscription tier
USAGE_LIMITS = {
    'free':    int(os.getenv('LIMIT_FREE',    1)),
    'premium': int(os.getenv('LIMIT_PREMIUM', 10)),
    'pro':     int(os.getenv('LIMIT_PRO',     100)),
}

# Subscription Pricing
# Paystack amounts are in kobo (1 NGN = 100 kobo)
# PayPal amounts are in cents (1 USD = 100 cents)
SUBSCRIPTION_PRICES = {
    # Premium plan — individual job seekers
    'monthly': {
        'paystack': int(os.getenv('PRICE_PREMIUM_MONTHLY_NGN', 1500000)),   # ₦15,000
        'paypal':   int(os.getenv('PRICE_PREMIUM_MONTHLY_USD', 1500)),      # $15.00
    },
    'yearly': {
        'paystack': int(os.getenv('PRICE_PREMIUM_YEARLY_NGN', 18000000)),   # ₦180,000
        'paypal':   int(os.getenv('PRICE_PREMIUM_YEARLY_USD', 18000)),      # $180.00
    },
    # Pro plan — recruiters and hiring teams
    'pro_monthly': {
        'paystack': int(os.getenv('PRICE_PRO_MONTHLY_NGN', 10000000)),      # ₦100,000
        'paypal':   int(os.getenv('PRICE_PRO_MONTHLY_USD', 6000)),          # $60.00
    },
    'pro_yearly': {
        'paystack': int(os.getenv('PRICE_PRO_YEARLY_NGN', 100000000)),      # ₦1,000,000
        'paypal':   int(os.getenv('PRICE_PRO_YEARLY_USD', 60000)),          # $600.00
    },
}

# Saved Resume Limits
MAX_SAVED_RESUMES = {
    'free':    1,
    'premium': 3,
    'pro':     int(os.getenv('MAX_SAVED_RESUMES_PRO', 10)),
}

# Batch Processing Limits (resumes per batch job)
MAX_BATCH_RESUMES = int(os.getenv('MAX_BATCH_RESUMES', 10))

# Subscription durations in days
SUBSCRIPTION_DURATIONS = {
    'monthly':     30,
    'yearly':      365,
    'pro_monthly': 30,
    'pro_yearly':  365,
}

# Which subscription tiers have recruiter access
RECRUITER_TIERS = {'premium', 'pro'}

# Which subscription tiers have premium (applicant) features
PREMIUM_TIERS = {'premium', 'pro'}

# SendGrid Email Configuration
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
# The verified sender address in your SendGrid account
SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', '[EMAIL_REDACTED]')
SENDGRID_FROM_NAME = os.getenv('SENDGRID_FROM_NAME', 'ATS Matcher')

# Frontend URL (used for password reset links, etc.)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
