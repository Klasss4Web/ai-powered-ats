from mangum import Mangum
from app import app

# Create the Lambda handler
handler = Mangum(app)