import os
from app import create_app

# Create the Flask application instance through the application factory
# The factory configures routes, security guards, cache headers and database setup
app = create_app()

# Local/LAN execution entry point
# This block is only executed when server.py is started directly
if __name__ == "__main__":
    # The port can be configured through the PORT environment variable
    # If no variable is provided, the application uses port 8000
    port = int(os.environ.get("PORT", "8000"))

    # host="0.0.0.0" makes the app reachable from other devices in the same LAN
    # debug=False disables auto-reload and avoids unwanted restarts during experiments
    # or demonstration/defense setups
    app.run(host="0.0.0.0", port=port, debug=False)