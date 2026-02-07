"""
Exception hierarchy for the Lemonade API client.

All exceptions inherit from LemonadeError, matching the official SDK spec.
"""

from typing import Optional


class LemonadeError(Exception):
    """Base exception for all Lemonade API errors."""

    def __init__(self, message: str = ""):
        self.message = message
        super().__init__(self.message)


class APIError(LemonadeError):
    """Server returned a 4xx or 5xx error."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        error_type: Optional[str] = None,
    ):
        self.status_code = status_code
        self.error_type = error_type
        super().__init__(message)


class ConnectionError(LemonadeError):
    """Cannot connect to the Lemonade Server."""

    pass


class ValidationError(LemonadeError):
    """Client-side validation failed (e.g., missing required fields)."""

    pass


# Backward compatibility alias
LemonadeAPIError = LemonadeError
