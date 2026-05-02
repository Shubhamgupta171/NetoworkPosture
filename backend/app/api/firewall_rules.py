"""GET /firewall-rules — flattened ruleset listing."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import AuthorizedRoute, store_dep
from app.models import FirewallRuleSet
from app.models.firewall import FirewallRule
from app.services.storage import Store

router = APIRouter(prefix="/firewall-rules", tags=["firewall"], dependencies=[AuthorizedRoute])


class FlattenedRule(FirewallRule):
    ruleset_id: str
    source_type: Literal["iptables", "aws-sg", "cisco-ios"]
    ruleset_name: str


@router.get("", response_model=list[FlattenedRule])
async def list_rules(
    source_type: str | None = Query(default=None),
    store: Store = Depends(store_dep),
) -> list[FlattenedRule]:
    out: list[FlattenedRule] = []
    for rs in store.list_rulesets():
        if source_type and rs.source_type != source_type:
            continue
        for r in rs.rules:
            out.append(
                FlattenedRule(
                    **r.model_dump(),
                    ruleset_id=rs.id,
                    source_type=rs.source_type,
                    ruleset_name=rs.name,
                )
            )
    return out


@router.get("/sets", response_model=list[FirewallRuleSet])
async def list_rulesets(store: Store = Depends(store_dep)) -> list[FirewallRuleSet]:
    return store.list_rulesets()
