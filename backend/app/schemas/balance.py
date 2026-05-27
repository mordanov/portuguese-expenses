import uuid
from datetime import datetime

from pydantic import BaseModel


class MemberRefResponse(BaseModel):
    id: uuid.UUID
    name: str


class BalanceEntry(BaseModel):
    debtor: MemberRefResponse
    creditor: MemberRefResponse
    amount: str


class BalanceResponse(BaseModel):
    balances: list[BalanceEntry]
    as_of: datetime
