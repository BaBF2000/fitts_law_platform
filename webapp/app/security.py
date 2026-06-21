from __future__ import annotations

from ipaddress import ip_address


def is_private_client(remote_addr: str | None) -> bool:
    """ 
    Check whether a client IP address belongs to an accepted local network range
    Args: 
        remote_addr (str | None): Client IP address as reported by Flask 
        through request.remote_addr. The value may be None if no address is available 
    Returns: 
        bool: True if the address belongs to a private, loopback or link-local 
        range. False if the address is missing, malformed or public 
    Accepted address categories: 
        - Private IPv4 ranges, e.g. 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 
        - IPv6 unique local addresses, e.g. fc00::/7 
        - Loopback addresses, e.g. 127.0.0.1 and ::1 
        - Link-local addresses, e.g. 169.254.0.0/16 and fe80::/10 
    Side effects: 
        None. The function only classifies the provided address 
    Failure behavior:
        Missing or malformed IP addresses are rejected by returning False 
    Related modules: 
        Used by app.__init__.lan_only_guard() to enforce LAN-only access 
        before Flask routes are executed
    Notes: 
        This function assumes that request.remote_addr reflects the real client 
        IP address. If the application runs behind a reverse proxy, ProxyFix 
        must be enabled in app.__init__.py and the proxy must be trusted 
        """

    if not remote_addr:
        return False

    try:
        ip = ip_address(remote_addr)

        # Covers RFC1918 private IPv4 ranges and IPv6 unique local addresses
        if ip.is_private:
            return True

        # Covers localhost access, for example during local development
        if ip.is_loopback:
            return True

        # Covers link-local addresses that may appear in local network setups
        if ip.is_link_local:
            return True
        
        # Public or otherwise non-local addresses are not accepted
        return False

    except ValueError:
        # Reject invalid or malformed IP address strings
        return False