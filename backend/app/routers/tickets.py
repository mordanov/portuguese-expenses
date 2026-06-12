import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.schemas.ticket import OCRDraft, TicketCreateRequest, TicketListResponse, TicketResponse
from app.services.ocr_service import OCRParseError, OCRService, OCRServiceError, UploadValidationError
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _ticket_to_response(ticket) -> dict:
    items = []
    for item in ticket.items:
        allocation_count = len(item.allocations)
        cost_per_member = (
            (item.discounted_price / allocation_count).quantize(Decimal("0.01"))
            if allocation_count > 0
            else Decimal("0.00")
        )
        items.append(
            {
                "id": str(item.id),
                "name": item.name,
                "price": str(item.price),
                "discounted_price": str(item.discounted_price),
                "position": item.position,
                "category": (
                    {
                        "id": str(item.category.id),
                        "name": item.category.name,
                        "color": item.category.color,
                    }
                    if item.category
                    else None
                ),
                "translation_en": item.translation_en,
                "translation_ru": item.translation_ru,
                "translation_pt": item.translation_pt,
                "allocated_members": [
                    {
                        "id": str(alloc.member.id),
                        "name": alloc.member.name,
                        "cost": str(cost_per_member),
                    }
                    for alloc in item.allocations
                ],
            }
        )
    return {
        "id": str(ticket.id),
        "store_name": ticket.store_name,
        "purchased_at": ticket.purchased_at.isoformat(),
        "paid_by": {"id": str(ticket.paid_by.id), "name": ticket.paid_by.name},
        "raw_image_url": ticket.raw_image_url,
        "total_price": str(ticket.total_price),
        "discount_total": str(ticket.discount_total),
        "created_at": ticket.created_at.isoformat(),
        "items": items,
    }


def get_ocr_service() -> OCRService:
    return OCRService()


@router.post("/upload", response_model=OCRDraft, dependencies=[Depends(require_admin)])
async def upload_receipt(
    file: UploadFile,
    ocr_service: OCRService = Depends(get_ocr_service),
) -> OCRDraft:
    try:
        return await ocr_service.process_upload(file)
    except UploadValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except OCRParseError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except OCRServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_ticket(
    body: TicketCreateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.config import get_settings as _gs
    from app.routers.items import _translate_and_save_item

    service = TicketService(session)
    ticket = await service.save_ticket(body)
    await session.commit()
    ticket = await service.repo.get_ticket_with_detail(ticket.id)
    db_url = _gs().database_url
    for item in ticket.items:
        background_tasks.add_task(_translate_and_save_item, item.id, item.name, db_url)
    return _ticket_to_response(ticket)


@router.get("")
async def list_tickets(
    page: int = 1,
    page_size: int = Query(default=20, ge=1, le=100),
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    member_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> dict:
    from app.repositories.ticket_repository import TicketRepository

    repo = TicketRepository(session)
    tickets, total = await repo.list_tickets(
        page=page,
        page_size=page_size,
        from_date=from_date,
        to_date=to_date,
        member_id=member_id,
        category_id=category_id,
    )
    items = [
        {
            "id": str(t.id),
            "store_name": t.store_name,
            "purchased_at": t.purchased_at.isoformat(),
            "paid_by": {"id": str(t.paid_by.id), "name": t.paid_by.name},
            "total_price": str(t.total_price),
            "discount_total": str(t.discount_total),
            "created_at": t.created_at.isoformat(),
        }
        for t in tickets
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> dict:
    service = TicketService(session)
    ticket = await service.get_ticket(ticket_id)
    return _ticket_to_response(ticket)


@router.put("/{ticket_id}", dependencies=[Depends(require_admin)])
async def update_ticket(
    ticket_id: uuid.UUID,
    body: dict,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.repositories.ticket_repository import TicketRepository
    from app.schemas.ticket import TicketUpdateRequest

    repo = TicketRepository(session)
    ticket = await repo.get_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update = TicketUpdateRequest(**body)
    if update.store_name is not None:
        ticket.store_name = update.store_name
    if update.purchased_at is not None:
        ticket.purchased_at = update.purchased_at
    if update.paid_by_id is not None:
        ticket.paid_by_id = update.paid_by_id
    if update.total_price is not None:
        ticket.total_price = Decimal(update.total_price)
    if update.discount_total is not None:
        ticket.discount_total = Decimal(update.discount_total)
    if update.raw_image_url is not None:
        ticket.raw_image_url = update.raw_image_url

    await session.flush()
    await session.commit()
    ticket = await repo.get_ticket_with_detail(ticket_id)
    return _ticket_to_response(ticket)


@router.post("/{ticket_id}/items", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def add_item_to_ticket(
    ticket_id: uuid.UUID,
    body: dict,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.repositories.item_repository import ItemRepository
    from app.repositories.ticket_repository import TicketRepository
    from app.schemas.item import ItemCreateRequest
    from app.services.ticket_service import compute_discounted_prices

    try:
        req = ItemCreateRequest(**body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not req.member_ids:
        raise HTTPException(status_code=422, detail="member_ids must not be empty")

    try:
        new_price = Decimal(req.price)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid price value") from exc

    ticket_repo = TicketRepository(session)
    ticket = await ticket_repo.get_ticket_with_detail(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    existing_prices = [i.price for i in ticket.items]
    all_prices = existing_prices + [new_price]
    discounted = compute_discounted_prices(all_prices, ticket.discount_total)
    new_discounted = discounted[-1]

    # Recompute existing items' discounted prices
    item_repo = ItemRepository(session)
    for item, dp in zip(ticket.items, discounted[:-1]):
        item.discounted_price = dp
    await session.flush()

    position = max((i.position for i in ticket.items), default=-1) + 1
    new_item = await item_repo.create_item(
        ticket_id=ticket_id,
        name=req.name,
        price=new_price,
        discounted_price=new_discounted,
        category_id=req.category_id,
        position=position,
        member_ids=req.member_ids,
    )

    # Update ticket total_price
    ticket.total_price = sum(all_prices)
    await session.commit()

    from app.routers.items import _item_to_dict, _translate_and_save_item
    from app.config import get_settings as _gs
    background_tasks.add_task(_translate_and_save_item, new_item.id, new_item.name, _gs().database_url)
    return _item_to_dict(new_item)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_ticket(
    ticket_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> None:
    service = TicketService(session)
    await service.delete_ticket(ticket_id)
    await session.commit()
