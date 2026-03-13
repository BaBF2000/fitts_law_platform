from __future__ import annotations

from ipaddress import ip_address


def is_private_client(remote_addr: str | None) -> bool:
    """
    Return True if the client IP address belongs to a private/local range.

    Accepted categories:
      - Private IPv4 ranges (RFC1918)
      - Loopback (127.0.0.0/8, ::1)
      - Link-local (169.254.0.0/16, fe80::/10)

    This function is designed for LAN-only enforcement.
    It assumes request.remote_addr reflects the real client IP.
    If running behind a reverse proxy, ProxyFix must be enabled.
    """

    if not remote_addr:
        return False

    try:
        ip = ip_address(remote_addr)

        # Covers:
        # - RFC1918 private ranges
        # - IPv6 unique local addresses (fc00::/7)
        if ip.is_private:
            return True

        # Loopback (127.0.0.1, ::1)
        if ip.is_loopback:
            return True

        # Link-local (169.254.x.x, fe80::/10)
        if ip.is_link_local:
            return True

        return False

    except ValueError:
        # Invalid or malformed IP
        return False