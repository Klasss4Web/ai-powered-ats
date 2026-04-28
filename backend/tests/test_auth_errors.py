import unittest
from unittest.mock import patch
from app import app

class AuthErrorTestCase(unittest.TestCase):
    def setUp(self):
        patcher = patch('app.init_db', lambda x=None: None)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.client = app.test_client()
        self.client.testing = True

    def test_protected_route_no_token(self):
        # /api/payment/initialize is protected by @token_required
        response = self.client.post('/api/payment/initialize', json={"email": "test@test.com", "amount": 1000})
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.json)
        self.assertIn('Token is missing', response.json['error'])

if __name__ == '__main__':
    unittest.main()
