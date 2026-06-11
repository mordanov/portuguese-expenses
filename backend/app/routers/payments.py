from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentCreateRequest, PaymentResponse

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def record_payment(
    body: PaymentCreateRequest,
    session: AsyncSession = Depends(get_async_session),
) -> PaymentResponse:
    if body.payer_id == body.payee_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Payer and payee must differ")
    repo = PaymentRepository(session)
    payment = await repo.create(
        payer_id=body.payer_id,
        payee_id=body.payee_id,
        amount=body.amount,
        note=body.note,
    )
    await session.commit()
    return PaymentResponse.from_orm_model(payment)
