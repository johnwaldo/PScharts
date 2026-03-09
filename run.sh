#!/usr/bin/env bash
# Launch the PractiScore Tracker Streamlit app
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
cd "$(dirname "$0")"
streamlit run app.py
