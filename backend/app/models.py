"""SQLAlchemy 2 async models — no JSON blobs for queryable fields."""
from datetime import datetime
from typing import Literal

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

IncidentStatus = Literal["open", "acknowledged", "escalated", "false_positive"]


class Base(DeclarativeBase):
    pass


class Asset(Base):
    __tablename__ = "assets"
    asset_id: Mapped[str] = mapped_column(String, primary_key=True)
    hostname: Mapped[str] = mapped_column(String, index=True)
    asset_type: Mapped[str] = mapped_column(String)
    department: Mapped[str] = mapped_column(String)
    owner: Mapped[str] = mapped_column(String)
    criticality: Mapped[int] = mapped_column(Integer)


class Alert(Base):
    __tablename__ = "alerts"
    alert_id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    asset_id: Mapped[str] = mapped_column(String, ForeignKey("assets.asset_id"), index=True)
    hostname: Mapped[str] = mapped_column(String)
    source_ip: Mapped[str] = mapped_column(String)
    username: Mapped[str] = mapped_column(String, index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float)
    ioc_match: Mapped[int] = mapped_column(Integer)
    ground_truth_incident_id: Mapped[str] = mapped_column(String, default="noise", index=True)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # INC-0001
    asset_id: Mapped[str] = mapped_column(String, ForeignKey("assets.asset_id"), index=True)
    risk_score: Mapped[float] = mapped_column(Float, index=True)
    severity: Mapped[str] = mapped_column(String, index=True)  # P1-P4
    alert_count: Mapped[int] = mapped_column(Integer)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    primary_technique: Mapped[str] = mapped_column(String, default="", index=True)
    status: Mapped[str] = mapped_column(String, default="open", index=True)
    ai_brief: Mapped[dict] = mapped_column(JSON, default=dict)
    risk_factors: Mapped[dict] = mapped_column(JSON, default=dict)
    graph: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())


class IncidentAlert(Base):
    __tablename__ = "incident_alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String, ForeignKey("incidents.id"), index=True)
    alert_id: Mapped[str] = mapped_column(String, ForeignKey("alerts.alert_id"), index=True)


class AnalystAudit(Base):
    __tablename__ = "analyst_audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String, ForeignKey("incidents.id"), index=True)
    action: Mapped[str] = mapped_column(String)
    analyst_id: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())


class SuppressionRule(Base):
    __tablename__ = "suppression_rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    asset_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String, default="")
    created_by: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())
