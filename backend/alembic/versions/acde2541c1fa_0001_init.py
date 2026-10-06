"""0001_init

Revision ID: acde2541c1fa
Revises: 
Create Date: 2026-10-06 01:02:24.327600

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'acde2541c1fa'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("asset_id", sa.String(), primary_key=True),
        sa.Column("hostname", sa.String(), nullable=False),
        sa.Column("asset_type", sa.String(), nullable=False),
        sa.Column("department", sa.String(), nullable=False),
        sa.Column("owner", sa.String(), nullable=False),
        sa.Column("criticality", sa.Integer(), nullable=False),
    )
    op.create_index("ix_assets_hostname", "assets", ["hostname"])
    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.String(), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("asset_id", sa.String(), sa.ForeignKey("assets.asset_id"), nullable=False),
        sa.Column("hostname", sa.String(), nullable=False),
        sa.Column("source_ip", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("ioc_match", sa.Integer(), nullable=False),
        sa.Column("ground_truth_incident_id", sa.String(), nullable=False, server_default="noise"),
    )
    for col in ("timestamp", "asset_id", "username", "event_type", "severity", "ground_truth_incident_id"):
        op.create_index(f"ix_alerts_{col}", "alerts", [col])
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("asset_id", sa.String(), sa.ForeignKey("assets.asset_id"), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("alert_count", sa.Integer(), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("primary_technique", sa.String(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("ai_brief", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("risk_factors", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("graph", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    for col in ("asset_id", "risk_score", "severity", "primary_technique", "status"):
        op.create_index(f"ix_incidents_{col}", "incidents", [col])
    op.create_table(
        "incident_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("incident_id", sa.String(), sa.ForeignKey("incidents.id"), nullable=False),
        sa.Column("alert_id", sa.String(), sa.ForeignKey("alerts.alert_id"), nullable=False),
    )
    op.create_index("ix_incident_alerts_incident_id", "incident_alerts", ["incident_id"])
    op.create_index("ix_incident_alerts_alert_id", "incident_alerts", ["alert_id"])
    op.create_table(
        "analyst_audit",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("incident_id", sa.String(), sa.ForeignKey("incidents.id"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("analyst_id", sa.String(), nullable=False),
        sa.Column("note", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_analyst_audit_incident_id", "analyst_audit", ["incident_id"])
    op.create_table(
        "suppression_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("asset_id", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=False, server_default=""),
        sa.Column("created_by", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_suppression_rules_event_type", "suppression_rules", ["event_type"])


def downgrade() -> None:
    for tbl in ("suppression_rules", "analyst_audit", "incident_alerts", "incidents", "alerts", "assets"):
        op.drop_table(tbl)
