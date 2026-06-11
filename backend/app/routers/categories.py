import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.schemas.category import CategoryCreate, CategoryListResponse, CategoryResponse, CategoryUpdate
from app.services.category_service import CategoryReferencedError, CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    page: int = 1,
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> CategoryListResponse:
    service = CategoryService(session)
    categories, total = await service.list_categories(page=page, page_size=page_size)
    return CategoryListResponse(
        items=[CategoryResponse.model_validate(c) for c in categories],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_category(
    body: CategoryCreate,
    session: AsyncSession = Depends(get_async_session),
) -> CategoryResponse:
    service = CategoryService(session)
    category = await service.create_category(body.name, body.color)
    await session.commit()
    return CategoryResponse.model_validate(category)


@router.put("/{category_id}", response_model=CategoryResponse, dependencies=[Depends(require_admin)])
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    session: AsyncSession = Depends(get_async_session),
) -> CategoryResponse:
    service = CategoryService(session)
    category = await service.update_category(category_id, body.name, body.color)
    await session.commit()
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_category(
    category_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> None:
    service = CategoryService(session)
    try:
        await service.delete_category(category_id)
        await session.commit()
    except CategoryReferencedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category is referenced by items and cannot be deleted",
        )
