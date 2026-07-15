import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.member_repository import MemberRepository
from app.repositories.payment_repository import PaymentRepository
from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    CategoryBreakdown,
    CategoryRefResponse,
    CategoryReportResponse,
    ItemizedItem,
    ItemizedResponse,
    ItemizedTicket,
    MemberRefResponse,
    MemberSummary,
    PaymentReportItem,
    PaymentsReportResponse,
    SummaryResponse,
)


class ReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ReportRepository(session)
        self.member_repo = MemberRepository(session)
        self.payment_repo = PaymentRepository(session)

    async def get_summary(self, from_date: date, to_date: date, project_id: uuid.UUID | None = None) -> SummaryResponse:
        rows = await self.repo.summary_query(from_date=from_date, to_date=to_date, project_id=project_id)
        members = [
            MemberSummary(
                member=MemberRefResponse(id=row["member_id"], name=row["member_name"]),
                total=str(Decimal(str(row["total"])).quantize(Decimal("0.01"))),
            )
            for row in rows
            if row["total"] is not None
        ]
        return SummaryResponse(from_date=from_date, to_date=to_date, members=members)

    async def get_itemized(self, from_date: date, to_date: date, member_id: uuid.UUID, project_id: uuid.UUID | None = None) -> ItemizedResponse:
        rows = await self.repo.itemized_query(from_date=from_date, to_date=to_date, member_id=member_id, project_id=project_id)

        tickets_map: dict[uuid.UUID, dict] = {}
        for row in rows:
            tid = row["ticket_id"]
            if tid not in tickets_map:
                tickets_map[tid] = {
                    "ticket": {
                        "id": str(tid),
                        "store_name": row["store_name"],
                        "purchased_at": row["purchased_at"].isoformat(),
                    },
                    "items": [],
                    "ticket_total": Decimal("0.00"),
                }
            cost = Decimal(str(row["member_cost"])).quantize(Decimal("0.01"))
            tickets_map[tid]["items"].append(
                ItemizedItem(
                    name=row["item_name"],
                    translation_en=row["translation_en"],
                    translation_ru=row["translation_ru"],
                    translation_pt=row["translation_pt"],
                    category_name=row["category_name"],
                    discounted_price=str(Decimal(str(row["discounted_price"])).quantize(Decimal("0.01"))),
                    member_cost=str(cost),
                )
            )
            tickets_map[tid]["ticket_total"] += cost

        itemized_tickets = [
            ItemizedTicket(
                ticket=v["ticket"],
                items=v["items"],
                ticket_total_for_member=str(v["ticket_total"]),
            )
            for v in tickets_map.values()
        ]
        grand_total = sum((Decimal(t.ticket_total_for_member) for t in itemized_tickets), Decimal("0.00"))

        name = await self.member_repo.get_name_by_id(member_id) or ""
        member = MemberRefResponse(id=member_id, name=name)

        return ItemizedResponse(
            member=member,
            from_date=from_date,
            to_date=to_date,
            tickets=itemized_tickets,
            grand_total=str(grand_total.quantize(Decimal("0.01"))),
        )

    async def get_category_report(self, from_date: date, to_date: date, project_id: uuid.UUID | None = None) -> CategoryReportResponse:
        data = await self.repo.category_query(from_date=from_date, to_date=to_date, project_id=project_id)
        category_rows = data["categories"]
        uncategorized = Decimal(str(data["uncategorized"])).quantize(Decimal("0.01"))

        cat_totals = [Decimal(str(row["total"])).quantize(Decimal("0.01")) for row in category_rows]
        overall_total = sum(cat_totals, Decimal("0.00")) + uncategorized.quantize(Decimal("0.01"))

        categories = []
        for row, total in zip(category_rows, cat_totals):
            percentage = (
                (total / overall_total * 100).quantize(Decimal("0.01")) if overall_total > 0 else Decimal("0.00")
            )
            categories.append(
                CategoryBreakdown(
                    category=CategoryRefResponse(
                        id=row["category_id"], name=row["category_name"], color=row["color"]
                    ),
                    total=str(total),
                    percentage=str(percentage),
                )
            )

        return CategoryReportResponse(
            from_date=from_date,
            to_date=to_date,
            total=str(overall_total),
            categories=categories,
            uncategorized=str(uncategorized),
        )

    async def get_payments_report(self, from_date: date, to_date: date, project_id: uuid.UUID | None = None) -> PaymentsReportResponse:
        from datetime import datetime, timezone

        from_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)

        payments = await self.payment_repo.list_in_range(from_date=from_dt, to_date=to_dt, project_id=project_id)

        all_member_ids = list({p.payer_id for p in payments} | {p.payee_id for p in payments})
        names: dict = {}
        if all_member_ids:
            from sqlalchemy import select
            from app.models.family_member import FamilyMember
            result = await self.payment_repo.session.execute(
                select(FamilyMember.id, FamilyMember.name).where(FamilyMember.id.in_(all_member_ids))
            )
            names = {row.id: row.name for row in result.all()}

        items = [
            PaymentReportItem(
                id=p.id,
                payer_id=p.payer_id,
                payer_name=names.get(p.payer_id, ""),
                payee_id=p.payee_id,
                payee_name=names.get(p.payee_id, ""),
                amount=str(Decimal(str(p.amount)).quantize(Decimal("0.01"))),
                paid_at=p.paid_at.isoformat(),
                note=p.note,
            )
            for p in payments
        ]
        total = sum((Decimal(i.amount) for i in items), Decimal("0.00"))
        return PaymentsReportResponse(
            from_date=from_date,
            to_date=to_date,
            payments=items,
            total=str(total.quantize(Decimal("0.01"))),
        )
