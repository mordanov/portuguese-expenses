import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user
from app.schemas.report import CategoryReportResponse, ItemizedResponse, SummaryResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=SummaryResponse)
async def summary_report(
    from_date: date,
    to_date: date,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> SummaryResponse:
    service = ReportService(session)
    return await service.get_summary(from_date=from_date, to_date=to_date)


@router.get("/itemized", response_model=ItemizedResponse)
async def itemized_report(
    from_date: date,
    to_date: date,
    member_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> ItemizedResponse:
    service = ReportService(session)
    return await service.get_itemized(from_date=from_date, to_date=to_date, member_id=member_id)


@router.get("/categories", response_model=CategoryReportResponse)
async def category_report(
    from_date: date,
    to_date: date,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> CategoryReportResponse:
    service = ReportService(session)
    return await service.get_category_report(from_date=from_date, to_date=to_date)
