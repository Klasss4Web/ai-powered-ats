import unittest
from unittest.mock import patch
from app import app

class UsageRouteTestCase(unittest.TestCase):
    def setUp(self):
        patcher = patch('app.init_db', lambda x=None: None)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.client = app.test_client()
        self.client.testing = True

    def test_usage_route_no_token(self):
        response = self.client.get('/api/user/usage')
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.json)
        self.assertIn('Token is missing', response.json['error'])

if __name__ == '__main__':
    unittest.main()
