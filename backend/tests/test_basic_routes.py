import unittest
from unittest.mock import patch
from app import app

class BasicRoutesTestCase(unittest.TestCase):
    def setUp(self):
        patcher = patch('app.init_db', lambda x=None: None)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.client = app.test_client()
        self.client.testing = True

    def test_index_route(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'ATS Matcher Backend', response.data)

    def test_health_route(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

if __name__ == '__main__':
    unittest.main()
