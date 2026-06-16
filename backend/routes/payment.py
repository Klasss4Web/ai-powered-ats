"""
Payment integration for ATS Matcher Backend (Paystack and PayPal)
"""

import json
from logger.app_logger import logger
import datetime
import requests
from flask import jsonify, g, request
from db.database import get_db
from config import (
    PAYSTACK_SECRET_KEY, PAYSTACK_PK_KEY, PAYSTACK_BASE_URL, PAYSTACK_CALLBACK_URL,
    PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL,
    SUBSCRIPTION_PRICES, SUBSCRIPTION_DURATIONS,
)


def get_paypal_access_token():
    """Get PayPal access token."""
    try:
        auth = (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        headers = {
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
        }
        data = {'grant_type': 'client_credentials'}
        response = requests.post(f'{PAYPAL_BASE_URL}/v1/oauth2/token', auth=auth, headers=headers, data=data)
        response.raise_for_status()
        return response.json()['access_token']
    except Exception as e:
        logger.error(f"PayPal auth error: {e}")
        return None


def register_payment_routes(app):
    """Register payment-related routes."""
    from auth.auth import token_required

    @app.route('/api/payment/initialize', methods=['POST'])
    @token_required
    def initialize_payment():
        """Initialize a payment transaction with Paystack or PayPal."""
        try:
            data = request.get_json()
            email = data.get('email')
            amount = data.get('amount')  # Amount in kobo for Paystack, cents for PayPal
            gateway = data.get('gateway', 'paystack')  # Default to paystack
            payment_type = data.get('payment_type', 'pay_as_you_go')  # 'pay_as_you_go' or 'subscription'
            plan_type = data.get('plan_type')  # 'monthly' or 'yearly' for subscriptions

            if not email or not amount:
                return jsonify({'error': 'Email and amount are required'}), 400

            if gateway == 'paypal':
                # PayPal integration
                if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
                    return jsonify({'error': 'PayPal payment service not configured'}), 500

                access_token = get_paypal_access_token()
                if not access_token:
                    return jsonify({'error': 'Failed to authenticate with PayPal'}), 500

                # Convert amount to USD cents format for PayPal
                amount_usd = amount / 100  # Assuming amount comes in cents

                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {access_token}'
                }

                paypal_payload = {
                    'intent': 'CAPTURE',
                    'purchase_units': [{
                        'amount': {
                            'currency_code': 'USD',
                            'value': f'{amount_usd:.2f}'
                        },
                        'description': f'ATS Matcher {payment_type.replace("_", " ").title()}{" - " + plan_type if plan_type else ""}'
                    }],
                    'application_context': {
                        'return_url': PAYSTACK_CALLBACK_URL,
                        'cancel_url': f'{PAYSTACK_CALLBACK_URL}?payment=cancelled'
                    }
                }

                response = requests.post(f'{PAYPAL_BASE_URL}/v2/checkout/orders', headers=headers, json=paypal_payload)
                result = response.json()

                if response.status_code == 201:
                    # Find approval URL
                    approval_url = None
                    for link in result.get('links', []):
                        if link.get('rel') == 'approve':
                            approval_url = link['href']
                            break

                    paypal_order_id = result['id']

                    # HIGH-11: Persist payment_type and plan_type keyed by order_id so that
                    # the verify endpoint can retrieve them without parsing the description text.
                    db = get_db()
                    cursor = db.cursor()
                    cursor.execute('''
                        INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                        VALUES (%s, %s, %s, %s)
                    ''', (
                        g.user_id,
                        'paypal_order_pending',
                        datetime.date.today(),
                        json.dumps({
                            'order_id': paypal_order_id,
                            'payment_type': payment_type,
                            'plan_type': plan_type,
                        })
                    ))
                    db.commit()

                    return jsonify({
                        'status': True,
                        'data': {
                            'authorization_url': approval_url,
                            'reference': paypal_order_id,
                            'gateway': 'paypal'
                        }
                    }), 200
                else:
                    return jsonify({'error': 'PayPal payment initialization failed', 'details': result}), 400

            else:
                # Paystack integration (default)
                if not PAYSTACK_SECRET_KEY:
                    return jsonify({'error': 'Paystack payment service not configured'}), 500

                url = f"{PAYSTACK_BASE_URL}/transaction/initialize"
                headers = {
                    'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}',
                    'Content-Type': 'application/json'
                }
                payload = {
                    'email': email,
                    'amount': str(amount),
                    'callback_url': PAYSTACK_CALLBACK_URL,
                    'metadata': {
                        'user_id': g.user_id,
                        'type': payment_type,
                        'plan_type': plan_type,
                        'gateway': gateway
                    }
                }

                response = requests.post(url, headers=headers, json=payload)
                result = response.json()

                if response.status_code == 200 and result.get('status'):
                    return jsonify(result), 200
                else:
                    return jsonify({'error': 'Payment initialization failed', 'details': result}), 400

        except Exception as e:
            logger.error(f"Payment initialization error: {e}")
            return jsonify({'error': 'Payment initialization failed'}), 500

    @app.route('/api/payment/verify/<reference>', methods=['GET'])
    @token_required
    def verify_payment(reference):
        """Verify a payment transaction with Paystack."""
        logger.info(f"Paystack verification called for reference: {reference}, user: {g.user_id}")
        try:
            if not PAYSTACK_SECRET_KEY:
                return jsonify({'error': 'Payment service not configured'}), 500

            url = f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}"
            headers = {
                'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}'
            }

            response = requests.get(url, headers=headers)
            result = response.json()
            logger.debug(f"Paystack API response: {result}")

            # Handle Paystack-specific errors
            if not result.get('status'):
                error_msg = result.get('message', 'Payment verification failed')
                logger.warning(f"Paystack verification failed for {reference}: {error_msg}")
                return jsonify({
                    'error': error_msg,
                    'details': result.get('meta', {})
                }), 400

            if result.get('data', {}).get('status') != 'success':
                txn_status = result.get('data', {}).get('status', 'unknown')
                logger.warning(f"Paystack transaction {reference} status: {txn_status}")
                return jsonify({
                    'error': f'Transaction status is "{txn_status}". Payment may not have been completed.',
                    'details': result.get('data')
                }), 400

            # Get payment metadata
            metadata = result.get('data', {}).get('metadata', {})
            payment_type = metadata.get('type', 'pay_as_you_go')
            plan_type = metadata.get('plan_type')

            # Check subscriptions table directly — the definitive source of truth
            db = get_db()
            cursor = db.cursor()
            cursor.execute('''
                SELECT id FROM subscriptions WHERE reference = %s
            ''', (reference,))
            existing = cursor.fetchone()
            
            if existing:
                logger.info("Payment already processed, skipping duplicate")
                return jsonify({
                    'status': 'already_verified',
                    'message': 'This payment has already been verified. No duplicate credit was applied.',
                    'data': result.get('data')
                }), 200

            # Process the payment
            if payment_type == 'subscription_upgrade':
                # Determine target subscription type and expiry duration from metadata.
                # target_subscription is 'premium' or 'pro'; falls back to 'premium'.
                target_sub = metadata.get('target_subscription', 'premium')
                days = SUBSCRIPTION_DURATIONS.get(plan_type, 30)
                expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=days)

                try:
                    # Update users table (current-state cache)
                    cursor.execute('''
                        UPDATE users
                        SET subscription_type = %s, subscription_expires_at = %s, subscription_updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (target_sub, expires_at.isoformat(), g.user_id))

                    # Record in subscriptions history table
                    amount_naira = result.get('data', {}).get('amount')
                    cursor.execute('''
                        INSERT INTO subscriptions (user_id, plan_type, amount, currency, gateway, reference, status, started_at, expires_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (g.user_id, target_sub, amount_naira, 'NGN', 'paystack', reference, 'active', datetime.datetime.utcnow(), expires_at))

                    # Record in usage_tracking for analytics
                    cursor.execute('''
                        INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                        VALUES (%s, %s, %s, %s)
                    ''', (g.user_id, 'subscription_upgrade', datetime.date.today().isoformat(), json.dumps({
                        'type': payment_type,
                        'reference': reference,
                        'gateway': 'paystack',
                        'plan_type': plan_type,
                        'target_subscription': target_sub
                    })))

                    db.commit()
                    logger.info(f"User {g.user_id} upgraded to {target_sub} ({plan_type})")
                except Exception as e:
                    db.rollback()
                    logger.error(f"Paystack subscription upgrade failed: {e}")
                    return jsonify({'error': 'Failed to process subscription upgrade. Please try again.'}), 500
            else:
                # Record pay-as-you-go payment
                try:
                    amount_naira = result.get('data', {}).get('amount')

                    # Record in subscriptions history table
                    cursor.execute('''
                        INSERT INTO subscriptions (user_id, plan_type, amount, currency, gateway, reference, status, started_at, expires_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (g.user_id, 'pay_as_you_go', amount_naira, 'NGN', 'paystack', reference, 'active', datetime.datetime.utcnow(), None))

                    # Record in usage_tracking for duplicate detection
                    cursor.execute('''
                        INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                        VALUES (%s, %s, %s, %s)
                    ''', (g.user_id, 'payment', datetime.date.today().isoformat(), json.dumps({
                        'amount': amount_naira,
                        'currency': 'NGN',
                        'type': payment_type,
                        'reference': reference,
                        'gateway': 'paystack'
                    })))

                    db.commit()
                    logger.info("Payment recorded successfully")
                except Exception as e:
                    db.rollback()
                    logger.error(f"Paystack pay-as-you-go failed: {e}")
                    return jsonify({'error': 'Failed to record payment. Please try again.'}), 500
            
            return jsonify(result), 200
            # else:
            #     logger.warning(f"Payment verification failed: {result}")
            #     return jsonify({'error': 'Payment verification failed', 'details': result}), 400

        except Exception as e:
            logger.error(f"Payment verification error: {e}")
            return jsonify({'error': 'Payment verification failed'}), 500

    @app.route('/api/payment/manual-verify/<reference>', methods=['POST'])
    @token_required
    def manual_verify_payment(reference):
        """Manually verify a payment transaction (for debugging)."""
        logger.info(f"Manual verification called for reference: {reference}, user: {g.user_id}")
        try:
            data = request.get_json()
            gateway = data.get('gateway', 'paystack')

            if gateway == 'paypal':
                # For PayPal, the reference is the order ID
                return verify_paypal_payment(reference)
            else:
                # For Paystack
                return verify_payment(reference)

        except Exception as e:
            logger.error(f"Manual verification error: {e}")
            return jsonify({'error': 'Manual verification failed'}), 500

    @app.route('/api/payment/verify-paypal/<order_id>', methods=['GET'])
    @token_required
    def verify_paypal_payment(order_id):
        """Verify PayPal payment."""
        print(f"PayPal verification called for order_id: {order_id}, user: {g.user_id}")
        try:
            if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
                return jsonify({'error': 'PayPal payment service not configured'}), 500

            access_token = get_paypal_access_token()
            if not access_token:
                return jsonify({'error': 'Failed to authenticate with PayPal'}), 500

            headers = {
                'Authorization': f'Bearer {access_token}'
            }

            # Get order details
            response = requests.get(f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}', headers=headers)
            result = response.json()
            print(f"PayPal order details: {result}")

            if response.status_code == 200 and result.get('status') == 'APPROVED':
                # Payment approved - now capture it
                capture_url = None
                for link in result.get('links', []):
                    if link.get('rel') == 'capture':
                        capture_url = link['href']
                        break
                
                if capture_url:
                    capture_response = requests.post(capture_url, headers=headers, json={})
                    capture_result = capture_response.json()
                    print(f"PayPal capture result: {capture_result}")
                    
                    if capture_response.status_code == 201 and capture_result.get('status') == 'COMPLETED':
                        # Get payment details
                        amount_usd = float(result.get('purchase_units', [{}])[0].get('amount', {}).get('value', 0))

                        # HIGH-11: Look up payment_type and plan_type from the DB record created
                        # at order initialization — never infer from description text.
                        db = get_db()
                        cursor = db.cursor()
                        cursor.execute('''
                            SELECT metadata FROM usage_tracking
                            WHERE user_id = %s
                              AND action_type = 'paypal_order_pending'
                              AND metadata::text LIKE %s
                            LIMIT 1
                        ''', (g.user_id, f'%"order_id": "{order_id}"%'))
                        pending_row = cursor.fetchone()

                        if pending_row and pending_row.get('metadata'):
                            meta = pending_row['metadata'] if isinstance(pending_row['metadata'], dict) else json.loads(pending_row['metadata'])
                            payment_type = meta.get('payment_type', 'pay_as_you_go')
                            plan_type = meta.get('plan_type')
                            target_sub = meta.get('target_subscription', 'premium')
                        else:
                            # Fallback — cannot determine type; treat as pay-as-you-go
                            logger.warning(f"No pending PayPal order record found for order_id {order_id}, user {g.user_id}")
                            payment_type = 'pay_as_you_go'
                            plan_type = None
                            target_sub = 'premium'

                        # Check subscriptions table directly — the definitive source of truth
                        db = get_db()
                        cursor = db.cursor()
                        cursor.execute('''
                            SELECT id FROM subscriptions WHERE reference = %s
                        ''', (order_id,))
                        existing = cursor.fetchone()

                        if existing:
                            print("PayPal payment already processed, skipping duplicate")
                            return jsonify({
                                'status': 'already_verified',
                                'message': 'This payment has already been verified. No duplicate credit was applied.',
                                'data': {
                                    'status': 'success',
                                    'amount': amount_usd,
                                    'currency': 'USD',
                                    'reference': order_id
                                }
                            }), 200

                        if payment_type == 'subscription_upgrade':
                            # Set correct subscription type and expiry from config
                            days = SUBSCRIPTION_DURATIONS.get(plan_type, 30)
                            expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=days)

                            try:
                                # Update users table (current-state cache)
                                cursor.execute('''
                                    UPDATE users
                                    SET subscription_type = %s, subscription_expires_at = %s, subscription_updated_at = CURRENT_TIMESTAMP
                                    WHERE id = %s
                                ''', (target_sub, expires_at.isoformat(), g.user_id))

                                # Record in subscriptions history table
                                cursor.execute('''
                                    INSERT INTO subscriptions (user_id, plan_type, amount, currency, gateway, reference, status, started_at, expires_at)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ''', (g.user_id, target_sub, amount_usd, 'USD', 'paypal', order_id, 'active', datetime.datetime.utcnow(), expires_at))

                                # Record in usage_tracking for analytics
                                cursor.execute('''
                                    INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                                    VALUES (%s, %s, %s, %s)
                                ''', (
                                    g.user_id,
                                    'subscription_upgrade',
                                    datetime.date.today(),
                                    json.dumps({
                                        'type': payment_type,
                                        'reference': order_id,
                                        'gateway': 'paypal',
                                        'plan_type': plan_type,
                                        'target_subscription': target_sub
                                    })
                                ))

                                db.commit()
                                logger.info(f"User {g.user_id} upgraded to {target_sub} ({plan_type}) via PayPal")
                            except Exception as e:
                                db.rollback()
                                logger.error(f"PayPal subscription upgrade failed: {e}")
                                return jsonify({'error': 'Failed to process subscription upgrade. Please try again.'}), 500
                        else:
                            # Record pay-as-you-go payment
                            try:
                                cursor.execute('''
                                    INSERT INTO subscriptions (user_id, plan_type, amount, currency, gateway, reference, status, started_at, expires_at)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ''', (g.user_id, 'pay_as_you_go', amount_usd, 'USD', 'paypal', order_id, 'active', datetime.datetime.utcnow(), None))

                                cursor.execute('''
                                    INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                                    VALUES (%s, %s, %s, %s)
                                ''', (
                                    g.user_id,
                                    'payment',
                                    datetime.date.today(),
                                    json.dumps({
                                        'amount': amount_usd,
                                        'currency': 'USD',
                                        'type': payment_type,
                                        'reference': order_id,
                                        'gateway': 'paypal'
                                    })
                                ))

                                db.commit()
                                print("PayPal payment recorded successfully")
                            except Exception as e:
                                db.rollback()
                                logger.error(f"PayPal pay-as-you-go failed: {e}")
                                return jsonify({'error': 'Failed to record payment. Please try again.'}), 500

                        return jsonify({
                            'status': True,
                            'data': {
                                'status': 'success',
                                'amount': amount_usd,
                                'currency': 'USD',
                                'reference': order_id
                            }
                        }), 200
                    else:
                        print(f"PayPal capture failed: {capture_result}")
                        return jsonify({'error': 'PayPal payment capture failed', 'details': capture_result}), 400
                else:
                    print("PayPal capture URL not found")
                    return jsonify({'error': 'PayPal capture URL not found'}), 400
            else:
                print(f"PayPal verification failed: {result}")
                return jsonify({'error': 'PayPal payment verification failed', 'details': result}), 400

        except Exception as e:
            print(f"PayPal verification error: {e}")
            return jsonify({'error': 'PayPal payment verification failed'}), 500

    @app.route('/api/payment/config', methods=['GET'])
    def get_payment_config():
        """Get payment configuration for frontend."""
        config = {}
        if PAYSTACK_PK_KEY:
            config['paystack_public_key'] = PAYSTACK_PK_KEY
        if PAYPAL_CLIENT_ID:
            config['paypal_client_id'] = PAYPAL_CLIENT_ID

        if not config:
            return jsonify({'error': 'Payment configuration not available'}), 500

        return jsonify(config), 200

    @app.route('/api/subscription/upgrade', methods=['POST'])
    @token_required
    def upgrade_subscription():
        """Upgrade user to a paid subscription (premium or pro)."""
        try:
            data = request.get_json()
            # Valid plan_type values: 'monthly', 'yearly', 'pro_monthly', 'pro_yearly'
            plan_type = data.get('plan_type', 'monthly')
            gateway = data.get('gateway', 'paystack')  # paystack or paypal

            if plan_type not in SUBSCRIPTION_PRICES or gateway not in ['paystack', 'paypal']:
                return jsonify({'error': 'Invalid plan type or payment gateway'}), 400

            amount = SUBSCRIPTION_PRICES[plan_type][gateway]

            # Derive which subscription_type this plan maps to
            target_subscription = 'pro' if plan_type.startswith('pro_') else 'premium'

            # Get user email
            db = get_db()
            cursor = db.cursor()
            cursor.execute('SELECT email FROM users WHERE id = %s', (g.user_id,))
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': 'User not found'}), 404

            # Initialize payment using the same logic as initialize_payment
            if gateway == 'paypal':
                # PayPal integration
                if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
                    return jsonify({'error': 'PayPal payment service not configured'}), 500

                access_token = get_paypal_access_token()
                if not access_token:
                    return jsonify({'error': 'Failed to authenticate with PayPal'}), 500

                # Convert amount to USD cents format for PayPal
                amount_usd = amount / 100  # Assuming amount comes in cents

                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {access_token}'
                }

                paypal_payload = {
                    'intent': 'CAPTURE',
                    'purchase_units': [{
                        'amount': {
                            'currency_code': 'USD',
                            'value': f'{amount_usd:.2f}'
                        },
                        'description': f'ATS Matcher Subscription Upgrade - {plan_type.title()}'
                    }],
                    'application_context': {
                        'return_url': PAYSTACK_CALLBACK_URL,
                        'cancel_url': f'{PAYSTACK_CALLBACK_URL}?payment=cancelled'
                    }
                }

                response = requests.post(f'{PAYPAL_BASE_URL}/v2/checkout/orders', headers=headers, json=paypal_payload)
                result = response.json()

                if response.status_code == 201:
                    # Find approval URL
                    approval_url = None
                    for link in result.get('links', []):
                        if link.get('rel') == 'approve':
                            approval_url = link['href']
                            break

                    paypal_order_id = result['id']

                    # HIGH-11: Persist payment_type, plan_type, and target_subscription at order creation.
                    db_sub = get_db()
                    cursor_sub = db_sub.cursor()
                    cursor_sub.execute('''
                        INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                        VALUES (%s, %s, %s, %s)
                    ''', (
                        g.user_id,
                        'paypal_order_pending',
                        datetime.date.today(),
                        json.dumps({
                            'order_id': paypal_order_id,
                            'payment_type': 'subscription_upgrade',
                            'plan_type': plan_type,
                            'target_subscription': target_subscription,
                        })
                    ))
                    db_sub.commit()

                    return jsonify({
                        'status': True,
                        'data': {
                            'authorization_url': approval_url,
                            'reference': paypal_order_id,
                            'gateway': 'paypal'
                        }
                    }), 200
                else:
                    return jsonify({'error': 'PayPal payment initialization failed', 'details': result}), 400

            else:
                # Paystack integration (default)
                if not PAYSTACK_SECRET_KEY:
                    return jsonify({'error': 'Paystack payment service not configured'}), 500

                url = f"{PAYSTACK_BASE_URL}/transaction/initialize"
                headers = {
                    'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}',
                    'Content-Type': 'application/json'
                }
                payload = {
                    'email': user['email'],
                    'amount': str(amount),
                    'callback_url': PAYSTACK_CALLBACK_URL,
                    'metadata': {
                        'user_id': g.user_id,
                        'type': 'subscription_upgrade',
                        'plan_type': plan_type,
                        'target_subscription': target_subscription,
                        'gateway': gateway
                    }
                }

                response = requests.post(url, headers=headers, json=payload)
                result = response.json()

                if response.status_code == 200 and result.get('status'):
                    return jsonify(result), 200
                else:
                    return jsonify({'error': 'Payment initialization failed', 'details': result}), 400

        except Exception as e:
            print(f"Subscription upgrade error: {e}")
            return jsonify({'error': 'Subscription upgrade failed'}), 500
