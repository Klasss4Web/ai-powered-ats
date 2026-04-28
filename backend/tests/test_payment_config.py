import unittest
from unittest.mock import patch
from app import app

class PaymentConfigTestCase(unittest.TestCase):
    def setUp(self):
        patcher = patch('app.init_db', lambda x=None: None)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.client = app.test_client()
        self.client.testing = True

    @patch('routes.payment.PAYSTACK_PK_KEY', 'test_pk')
    @patch('routes.payment.PAYPAL_CLIENT_ID', 'test_paypal')
    def test_payment_config(self):
        response = self.client.get('/api/payment/config')
        self.assertEqual(response.status_code, 200)
        self.assertIn('paystack_public_key', response.json)
        self.assertIn('paypal_client_id', response.json)

if __name__ == '__main__':
    unittest.main()
