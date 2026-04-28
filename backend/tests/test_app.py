
import unittest
from unittest.mock import patch
from app import app

class AppTestCase(unittest.TestCase):

    def setUp(self):
        # Patch the init_db function to prevent DB connection
        patcher = patch('app.init_db', lambda x=None: None)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.app = app.test_client()
        self.app.testing = True

    def test_home(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

if __name__ == '__main__':
    unittest.main()