import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PaymentCreateRequest(BaseModel):
    payer_id: uuid.UUID
    payee_id: uuid.UUID
    amount: Decimal = Field(gt=Decimal("0"), decimal_places=2)
    note: str | None = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    payer_id: uuid.UUID
    payee_id: uuid.UUID
    amount: str
    paid_at: datetime
    note: str | None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, payment: object) -> "PaymentResponse":
        from app.models.payment import Payment as PaymentModel
        p: PaymentModel = payment  # type: ignore[assignment]
        return cls(
            id=p.id,
            payer_id=p.payer_id,
            payee_id=p.payee_id,
            amount=str(p.amount),
            paid_at=p.paid_at,
            note=p.note,
        )
