from datetime import datetime
from decimal import Decimal

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.allocation import Allocation
from app.models.family_member import FamilyMember
from app.models.item import Item
from app.models.ticket import Ticket


class BalanceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_pairwise_balances(
        self, from_date: datetime | None = None, to_date: datetime | None = None
    ) -> list[dict]:
        """
        Two-pass computation:
        1. Fetch all (creditor_id, debtor_id, cost) rows
        2. Group and net in Python using Decimal arithmetic
        """
        alloc_count_subq = (
            select(Allocation.item_id, func.count(Allocation.id).label("cnt"))
            .group_by(Allocation.item_id)
            .subquery()
        )

        stmt = (
            select(
                Ticket.paid_by_id.label("creditor_id"),
                Allocation.member_id.label("debtor_id"),
                Item.discounted_price.label("discounted_price"),
                alloc_count_subq.c.cnt.label("cnt"),
            )
            .join(Item, Item.ticket_id == Ticket.id)
            .join(Allocation, Allocation.item_id == Item.id)
            .join(alloc_count_subq, alloc_count_subq.c.item_id == Item.id)
            .where(Allocation.member_id != Ticket.paid_by_id)
        )
        if from_date:
            stmt = stmt.where(Ticket.purchased_at >= from_date)
        if to_date:
            stmt = stmt.where(Ticket.purchased_at <= to_date)

        result = await self.session.execute(stmt)
        rows = result.all()

        # Aggregate gross(creditor→debtor)
        gross: dict[tuple, Decimal] = {}
        for row in rows:
            key = (row.creditor_id, row.debtor_id)
            cost = Decimal(str(row.discounted_price)) / Decimal(str(row.cnt))
            gross[key] = gross.get(key, Decimal("0")) + cost

        # Net: balance(A→B) = gross(A→B) - gross(B→A)
        seen: set[tuple] = set()
        net_rows = []
        for (creditor_id, debtor_id), amount in gross.items():
            if (debtor_id, creditor_id) in seen:
                continue
            seen.add((creditor_id, debtor_id))
            reverse = gross.get((debtor_id, creditor_id), Decimal("0"))
            net = amount - reverse
            if net > 0:
                net_rows.append((debtor_id, creditor_id, net.quantize(Decimal("0.01"))))
            elif net < 0:
                net_rows.append((creditor_id, debtor_id, (-net).quantize(Decimal("0.01"))))

        if not net_rows:
            return []

        # Fetch member names
        all_member_ids = list({r[0] for r in net_rows} | {r[1] for r in net_rows})
        member_result = await self.session.execute(
            select(FamilyMember.id, FamilyMember.name).where(FamilyMember.id.in_(all_member_ids))
        )
        names = {row.id: row.name for row in member_result.all()}

        return [
            {
                "debtor_id": debtor_id,
                "debtor_name": names.get(debtor_id, ""),
                "creditor_id": creditor_id,
                "creditor_name": names.get(creditor_id, ""),
                "amount": amount,
            }
            for debtor_id, creditor_id, amount in sorted(net_rows, key=lambda r: r[2], reverse=True)
        ]
