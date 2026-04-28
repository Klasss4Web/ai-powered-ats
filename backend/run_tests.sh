#!/bin/bash
# Run all backend tests with coverage from the backend directory (bash version)
cd "$(dirname "$0")"
source .venv/bin/activate
python -m coverage run -m unittest discover -s tests
python -m coverage report

# From backend directory, run this script to execute all tests and see the coverage report. Make sure you have the virtual environment set up and the necessary dependencies installed before running this script.

#  bash run_tests.sh