import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket import Ticket
from app.repositories.member_repository import MemberRepository
from app.repositories.ticket_repository import TicketRepository
from app.schemas.ticket import TicketCreateRequest


def compute_discounted_prices(prices: list[Decimal], discount_total: Decimal) -> list[Decimal]:
    """Proportionally distribute discount_total across items by price weight."""
    subtotal = sum(prices)
    if subtotal == Decimal("0"):
        return [Decimal("0.00") for _ in prices]

    result = []
    for price in prices:
        discounted = price - (price / subtotal) * discount_total
        discounted = max(Decimal("0.00"), discounted)
        result.append(discounted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return result


class TicketService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TicketRepository(session)
        self.member_repo = MemberRepository(session)

    async def save_ticket(self, request: TicketCreateRequest) -> Ticket:
        payer = await self.member_repo.get_by_id(request.paid_by_id)
        if not payer or not payer.is_active:
            raise HTTPException(status_code=422, detail="paid_by_id references an unknown or inactive member")

        try:
            total_price = Decimal(request.total_price)
            discount_total = Decimal(request.discount_total)
        except InvalidOperation as exc:
            raise HTTPException(status_code=422, detail="Invalid monetary value") from exc

        prices = []
        for item in request.items:
            if not item.member_ids:
                raise HTTPException(status_code=422, detail=f"Item '{item.name}' has no member_ids")
            try:
                prices.append(Decimal(item.price))
            except InvalidOperation as exc:
                raise HTTPException(status_code=422, detail=f"Invalid price for item '{item.name}'") from exc

        all_member_ids = {mid for item in request.items for mid in item.member_ids}
        members = {m.id: m for m in (await self.member_repo.list_all())[0]}
        for mid in all_member_ids:
            member = members.get(mid)
            if not member:
                raise HTTPException(status_code=422, detail=f"Member {mid} not found")
            if not member.is_active:
                raise HTTPException(status_code=422, detail=f"Member {mid} is inactive")

        discounted = compute_discounted_prices(prices, discount_total)

        items_data = []
        for item, dp in zip(request.items, discounted):
            items_data.append(
                {
                    "name": item.name,
                    "price": Decimal(item.price),
                    "discounted_price": dp,
                    "category_id": item.category_id,
                    "position": item.position,
                    "member_ids": item.member_ids,
                }
            )

        return await self.repo.create_ticket_with_items_and_allocations(
            store_name=request.store_name,
            purchased_at=request.purchased_at,
            paid_by_id=request.paid_by_id,
            total_price=total_price,
            discount_total=discount_total,
            raw_image_url=request.raw_image_url,
            items_data=items_data,
        )

    async def get_ticket(self, ticket_id: uuid.UUID) -> Ticket:
        ticket = await self.repo.get_ticket_with_detail(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return ticket

    async def delete_ticket(self, ticket_id: uuid.UUID) -> None:
        ticket = await self.repo.get_by_id(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        await self.session.delete(ticket)
        await self.session.flush()
