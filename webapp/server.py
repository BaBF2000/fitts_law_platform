import os
from app import create_app

app = create_app()

# Entry point for local/LAN execution
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    # debug=False => no auto-reload (clean defense setup)
    app.run(host="0.0.0.0", port=port, debug=False)