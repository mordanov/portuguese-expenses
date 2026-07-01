import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.allocation import Allocation
from app.models.category import Category
from app.models.family_member import FamilyMember
from app.models.item import Item
from app.models.ticket import Ticket


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _alloc_count_subq(self):
        return (
            select(Allocation.item_id, func.count(Allocation.id).label("cnt"))
            .group_by(Allocation.item_id)
            .subquery()
        )

    def _date_filter(self, stmt, from_date: date, to_date: date):
        from datetime import datetime, timezone

        from_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        return stmt.where(Ticket.purchased_at >= from_dt).where(Ticket.purchased_at <= to_dt)

    async def summary_query(self, from_date: date, to_date: date) -> list[dict]:
        alloc_count_subq = self._alloc_count_subq()
        stmt = (
            select(
                FamilyMember.id.label("member_id"),
                FamilyMember.name.label("member_name"),
                Item.discounted_price.label("dp"),
                alloc_count_subq.c.cnt.label("cnt"),
            )
            .join(Allocation, Allocation.member_id == FamilyMember.id)
            .join(Item, Item.id == Allocation.item_id)
            .join(Ticket, Ticket.id == Item.ticket_id)
            .join(alloc_count_subq, alloc_count_subq.c.item_id == Item.id)
        )
        stmt = self._date_filter(stmt, from_date, to_date)
        result = await self.session.execute(stmt)
        rows = result.all()

        totals: dict[uuid.UUID, dict] = {}
        for row in rows:
            if row.member_id not in totals:
                totals[row.member_id] = {"member_id": row.member_id, "member_name": row.member_name, "total": Decimal("0")}
            totals[row.member_id]["total"] += Decimal(str(row.dp)) / Decimal(str(row.cnt))

        return sorted(totals.values(), key=lambda r: r["total"], reverse=True)

    async def itemized_query(self, from_date: date, to_date: date, member_id: uuid.UUID) -> list[dict]:
        alloc_count_subq = self._alloc_count_subq()
        stmt = (
            select(
                Ticket.id.label("ticket_id"),
                Ticket.store_name,
                Ticket.purchased_at,
                Item.id.label("item_id"),
                Item.name.label("item_name"),
                Item.translation_en,
                Item.translation_ru,
                Item.translation_pt,
                Item.discounted_price.label("discounted_price"),
                Item.position,
                alloc_count_subq.c.cnt.label("cnt"),
            )
            .join(Allocation, Allocation.item_id == Item.id)
            .join(Ticket, Ticket.id == Item.ticket_id)
            .join(alloc_count_subq, alloc_count_subq.c.item_id == Item.id)
            .where(Allocation.member_id == member_id)
            .order_by(Ticket.purchased_at.desc(), Ticket.id, Item.position)
        )
        stmt = self._date_filter(stmt, from_date, to_date)
        result = await self.session.execute(stmt)
        rows = result.all()
        return [
            {
                "ticket_id": row.ticket_id,
                "store_name": row.store_name,
                "purchased_at": row.purchased_at,
                "item_id": row.item_id,
                "item_name": row.item_name,
                "translation_en": row.translation_en,
                "translation_ru": row.translation_ru,
                "translation_pt": row.translation_pt,
                "discounted_price": row.discounted_price,
                "member_cost": Decimal(str(row.discounted_price)) / Decimal(str(row.cnt)),
            }
            for row in rows
        ]

    async def category_query(self, from_date: date, to_date: date) -> dict:
        alloc_count_subq = self._alloc_count_subq()

        cat_stmt = (
            select(
                Category.id.label("category_id"),
                Category.name.label("category_name"),
                Category.color,
                Item.discounted_price.label("dp"),
                alloc_count_subq.c.cnt.label("cnt"),
            )
            .join(Allocation, Allocation.item_id == Item.id)
            .join(Ticket, Ticket.id == Item.ticket_id)
            .join(Category, Category.id == Item.category_id)
            .join(alloc_count_subq, alloc_count_subq.c.item_id == Item.id)
            .where(Item.category_id.isnot(None))
        )
        cat_stmt = self._date_filter(cat_stmt, from_date, to_date)
        cat_result = await self.session.execute(cat_stmt)
        cat_rows = cat_result.all()

        category_totals: dict[uuid.UUID, dict] = {}
        for row in cat_rows:
            if row.category_id not in category_totals:
                category_totals[row.category_id] = {
                    "category_id": row.category_id,
                    "category_name": row.category_name,
                    "color": row.color,
                    "total": Decimal("0"),
                }
            category_totals[row.category_id]["total"] += Decimal(str(row.dp)) / Decimal(str(row.cnt))

        uncat_stmt = (
            select(
                Item.discounted_price.label("dp"),
                alloc_count_subq.c.cnt.label("cnt"),
            )
            .join(Allocation, Allocation.item_id == Item.id)
            .join(Ticket, Ticket.id == Item.ticket_id)
            .join(alloc_count_subq, alloc_count_subq.c.item_id == Item.id)
            .where(Item.category_id.is_(None))
        )
        uncat_stmt = self._date_filter(uncat_stmt, from_date, to_date)
        uncat_result = await self.session.execute(uncat_stmt)
        uncat_rows = uncat_result.all()
        uncategorized = sum(Decimal(str(r.dp)) / Decimal(str(r.cnt)) for r in uncat_rows)

        return {
            "categories": sorted(category_totals.values(), key=lambda r: r["total"], reverse=True),
            "uncategorized": uncategorized,
        }
