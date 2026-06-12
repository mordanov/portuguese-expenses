import uuid
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.repositories.item_repository import ItemRepository
from app.repositories.ticket_repository import TicketRepository
from app.schemas.item import AllocationReplaceRequest, AllocationResponse, ItemUpdateRequest
from app.services.ticket_service import compute_discounted_prices

router = APIRouter(prefix="/items", tags=["items"])


def _item_to_dict(item) -> dict:
    allocation_count = len(item.allocations)
    cost_per_member = (
        (item.discounted_price / allocation_count).quantize(Decimal("0.01"))
        if allocation_count > 0
        else Decimal("0.00")
    )
    return {
        "id": str(item.id),
        "name": item.name,
        "price": str(item.price),
        "discounted_price": str(item.discounted_price),
        "position": item.position,
        "translation_en": item.translation_en,
        "translation_ru": item.translation_ru,
        "translation_pt": item.translation_pt,
        "category": (
            {
                "id": str(item.category.id),
                "name": item.category.name,
                "color": item.category.color,
            }
            if item.category
            else None
        ),
        "allocated_members": [
            {
                "id": str(alloc.member.id),
                "name": alloc.member.name,
                "cost": str(cost_per_member),
            }
            for alloc in item.allocations
        ],
    }


async def _translate_and_save_item(item_id: uuid.UUID, name: str, database_url: str) -> None:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AsyncSession, async_sessionmaker
    from app.services.translation_service import translate_item_names
    from app.models.item import Item as ItemModel
    from sqlalchemy import select

    translations = await translate_item_names([name])
    if not translations:
        return
    t = translations[0]
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=_AsyncSession)
    try:
        async with factory() as session:
            result = await session.execute(select(ItemModel).where(ItemModel.id == item_id))
            item = result.scalar_one_or_none()
            if item:
                item.translation_en = t["en"]
                item.translation_ru = t["ru"]
                item.translation_pt = t["pt"]
                await session.commit()
    finally:
        await engine.dispose()


@router.put("/{item_id}", dependencies=[Depends(require_admin)])
async def update_item(
    item_id: uuid.UUID,
    body: ItemUpdateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    item_repo = ItemRepository(session)
    item = await item_repo.get_by_id_with_detail(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    new_price = None
    if body.price is not None:
        try:
            new_price = Decimal(body.price)
        except InvalidOperation as exc:
            raise HTTPException(status_code=422, detail="Invalid price value") from exc

    if new_price is not None:
        ticket_repo = TicketRepository(session)
        ticket = await ticket_repo.get_ticket_with_detail(item.ticket_id)
        if ticket:
            prices = [i.price if i.id != item_id else new_price for i in ticket.items]
            discounted = compute_discounted_prices(prices, ticket.discount_total)
            idx = next(i for i, it in enumerate(ticket.items) if it.id == item_id)
            new_discounted = discounted[idx]
        else:
            new_discounted = new_price
    else:
        new_discounted = None

    name_changed = body.name is not None and body.name != item.name
    item = await item_repo.update_item(
        item,
        name=body.name,
        price=new_price,
        category_id=body.category_id,
        position=body.position,
        discounted_price=new_discounted,
    )
    if name_changed:
        item.translation_en = None
        item.translation_ru = None
        item.translation_pt = None
        await session.flush()
    await session.commit()
    if name_changed:
        from app.config import get_settings as _gs
        background_tasks.add_task(_translate_and_save_item, item.id, item.name, _gs().database_url)
    return _item_to_dict(item)


@router.put("/{item_id}/allocations", response_model=AllocationResponse, dependencies=[Depends(require_admin)])
async def replace_allocations(
    item_id: uuid.UUID,
    body: AllocationReplaceRequest,
    session: AsyncSession = Depends(get_async_session),
) -> AllocationResponse:
    if not body.member_ids:
        raise HTTPException(status_code=422, detail="member_ids must not be empty")

    item_repo = ItemRepository(session)
    item = await item_repo.get_by_id_with_detail(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await item_repo.replace_allocations(item_id, body.member_ids)
    await session.commit()
    session.expire_all()
    item = await item_repo.get_by_id_with_detail(item_id)

    allocation_count = len(item.allocations)
    cost_per_member = (
        (item.discounted_price / allocation_count).quantize(Decimal("0.01"))
        if allocation_count > 0
        else Decimal("0.00")
    )
    return AllocationResponse(
        item_id=item_id,
        allocated_members=[
            {"id": alloc.member.id, "name": alloc.member.name, "cost": str(cost_per_member)}
            for alloc in item.allocations
        ],
    )
