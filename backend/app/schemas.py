"""Pydantic v2 data contracts — no ORM imports."""
from datetime import datetime
from ipaddress import IPv4Address, IPv6Address
from typing import Literal, Union

from pydantic import BaseModel, Field

Severity = Literal["Low", "Medium", "High", "Critical"]
AnalystActionType = Literal["acknowledge", "escalate", "false_positive"]


class AlertIn(BaseModel):
    model_config = {"extra": "allow"}
    alert_id: str
    timestamp: datetime
    asset_id: str
    hostname: str
    source_ip: Union[IPv4Address, IPv6Address]
    username: str
    event_type: str
    severity: Severity
    description: str
    confidence: float = Field(ge=0, le=1)
    ioc_match: int = Field(ge=0, le=1)
    gt: str = "noise"

class AssetIn(BaseModel):
    asset_id: str
    hostname: str
    asset_type: str
    department: str
    owner: str
    criticality: int = Field(ge=1, le=5)


class AnalyzeRequest(BaseModel):
    alerts: list[AlertIn]
    assets: list[AssetIn]


class AnalystAction(BaseModel):
    action: AnalystActionType
    analyst_id: str = "analyst-01"
    note: str = ""
