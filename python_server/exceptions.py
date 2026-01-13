"""
Unified exception handling and error responses for RushRank API.

This module provides:
- Custom exception classes with consistent error codes
- Unified error response format: {"error": str, "code": str, "details": dict | None}
- Exception handlers for FastAPI
"""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base exception for application errors with unified format."""
    
    def __init__(
        self, 
        message: str, 
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)
    
    def to_response(self) -> Dict[str, Any]:
        """Convert to unified error response format."""
        response = {
            "error": self.message,
            "code": self.code,
        }
        if self.details:
            response["details"] = self.details
        return response


class ValidationError(AppException):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details={"field": field, **(details or {})} if field else details
        )


class NotFoundError(AppException):
    """Raised when a resource is not found."""
    
    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found" if not identifier else f"{resource} '{identifier}' not found"
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier} if identifier else None
        )


class UnauthorizedError(AppException):
    """Raised when authentication is required but missing or invalid."""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=401
        )


class ForbiddenError(AppException):
    """Raised when user lacks permission for an action."""
    
    def __init__(self, message: str = "You don't have permission to perform this action"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=403
        )


class ConflictError(AppException):
    """Raised when there's a conflict (e.g., duplicate resource)."""
    
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
            details=details
        )


class RateLimitError(AppException):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429
        )


def create_error_response(
    error: str,
    code: str,
    status_code: int,
    details: Optional[Dict[str, Any]] = None
) -> JSONResponse:
    """Create a unified error JSONResponse."""
    content = {"error": error, "code": code}
    if details:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle AppException and return unified error response."""
    logger.warning(f"AppException: {exc.code} - {exc.message}", extra={"details": exc.details})
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response()
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTPException and convert to unified format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "code": "HTTP_ERROR",
        }
    )


def register_exception_handlers(app):
    """Register all exception handlers on the FastAPI app."""
    app.add_exception_handler(AppException, app_exception_handler)
    # Note: Don't override HTTPException handler if you want FastAPI's default behavior
    # app.add_exception_handler(HTTPException, http_exception_handler)
