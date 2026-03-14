"""
Blog API routes for the Vector landing page.

Provides endpoints to list, read, create, update, and delete blog posts.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app import blog_db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/blog", tags=["blog"])


async def verify_api_key(x_blog_api_key: str = Header(alias="X-Blog-API-Key", default="")) -> None:
    """Require a valid API key for write operations."""
    if not settings.BLOG_API_KEY:
        raise HTTPException(status_code=500, detail="Blog API key not configured on server")
    if x_blog_api_key != settings.BLOG_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class PostCreate(BaseModel):
    title: str
    slug: str
    excerpt: str = ""
    content: str = ""
    cover_image: str = ""
    category: str = "General"
    tags: list[str] = []
    faq: list[dict] = []
    author: str = "Vector Team"
    status: str = "draft"
    read_time: int = 5


class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    faq: Optional[list[dict]] = None
    author: Optional[str] = None
    status: Optional[str] = None
    read_time: Optional[int] = None


# ---------------------------------------------------------------------------
# List posts
# ---------------------------------------------------------------------------

@router.get("/posts")
async def list_posts(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str = Query("", description="Filter by category"),
    status: str = Query("published", description="Filter by status (empty string for all)"),
):
    """List blog posts with optional category and status filter."""
    return blog_db.get_posts(limit=limit, offset=offset, category=category, status=status)


# ---------------------------------------------------------------------------
# Single post by slug
# ---------------------------------------------------------------------------

@router.get("/posts/{slug}")
async def get_post(slug: str):
    """Get a single blog post by slug."""
    post = blog_db.get_post_by_slug(slug)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ---------------------------------------------------------------------------
# Create post
# ---------------------------------------------------------------------------

@router.post("/posts", dependencies=[Depends(verify_api_key)])
async def create_post(body: PostCreate):
    """Create a new blog post."""
    data = body.model_dump()
    post = blog_db.create_post(data)
    return post


# ---------------------------------------------------------------------------
# Update post
# ---------------------------------------------------------------------------

@router.put("/posts/{post_id}", dependencies=[Depends(verify_api_key)])
async def update_post(post_id: str, body: PostUpdate):
    """Update an existing blog post."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    post = blog_db.update_post(post_id, data)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ---------------------------------------------------------------------------
# Delete post
# ---------------------------------------------------------------------------

@router.delete("/posts/{post_id}", dependencies=[Depends(verify_api_key)])
async def delete_post(post_id: str):
    """Delete a blog post."""
    ok = blog_db.delete_post(post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories")
async def list_categories():
    """List all categories with post counts."""
    return {"categories": blog_db.get_categories()}
