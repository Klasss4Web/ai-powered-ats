@echo off
REM Run all backend tests with coverage from the backend directory
cd /d %~dp0\..
.venv\Scripts\activate
.venv\Scripts\python.exe -m coverage run -m unittest discover -s tests
.venv\Scripts\python.exe -m coverage report


# From backend/scripts directory, run this script to execute all tests and see the coverage report. Make sure you have the virtual environment set up and the necessary dependencies installed before running this script.

# chmod +x run_tests.sh
# ./run_tests.sh