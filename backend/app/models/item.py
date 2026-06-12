import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discounted_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    translation_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    translation_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    translation_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="items")  # noqa: F821
    category: Mapped["Category | None"] = relationship("Category", back_populates="items")  # noqa: F821
    allocations: Mapped[list["Allocation"]] = relationship(  # noqa: F821
        "Allocation", back_populates="item", cascade="all, delete-orphan"
    )
