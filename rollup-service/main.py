# ============================================================
# JiraForge · Roll-up Service
# FastAPI microservice for Jira webhook processing
# Deploy: Railway · Python 3.11+
# ============================================================

from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import httpx
import hmac
import hashlib
import os
import json
import logging
from datetime import datetime
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jiraforge-rollup")

app = FastAPI(title="JiraForge Roll-up Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
JIRAFORGE_API_URL = os.environ.get("JIRAFORGE_API_URL", "https://jiraforge.vercel.app")

# ─── Supabase helpers ─────────────────────────────────────

async def supabase_get(path: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
        )
        res.raise_for_status()
        return res.json()

async def supabase_post(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=payload,
        )
        res.raise_for_status()
        return res.json()

# ─── Jira API helpers ─────────────────────────────────────

async def get_jira_credentials(connection_id: str) -> tuple[str, dict]:
    """Fetch and decrypt credentials via JiraForge internal API"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{JIRAFORGE_API_URL}/api/connections/{connection_id}/credentials",
            headers={"x-internal-key": os.environ["INTERNAL_API_KEY"]},
        )
        res.raise_for_status()
        data = res.json()
        return data["base_url"], data["headers"]

async def get_issue_children(base_url: str, auth_headers: dict, parent_key: str) -> list[dict]:
    """Get all child issues of a parent"""
    jql = f'parent = {parent_key}'
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{base_url}/rest/api/3/search",
            params={"jql": jql, "fields": "status,issuetype,summary", "maxResults": 200},
            headers=auth_headers,
        )
        res.raise_for_status()
        return res.json().get("issues", [])

async def get_issue(base_url: str, auth_headers: dict, issue_key: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{base_url}/rest/api/3/issue/{issue_key}",
            params={"fields": "status,issuetype,summary,parent,customfield_10014"},
            headers=auth_headers,
        )
        res.raise_for_status()
        return res.json()

async def get_transitions(base_url: str, auth_headers: dict, issue_key: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
            headers=auth_headers,
        )
        res.raise_for_status()
        return res.json().get("transitions", [])

async def transition_issue(base_url: str, auth_headers: dict, issue_key: str, transition_id: str) -> bool:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"transition": {"id": transition_id}},
        )
        return res.status_code == 204

async def find_done_transition(base_url: str, auth_headers: dict, issue_key: str) -> Optional[str]:
    """Find the transition ID that leads to a 'Done' status"""
    transitions = await get_transitions(base_url, auth_headers, issue_key)
    for t in transitions:
        if t.get("to", {}).get("statusCategory", {}).get("key") == "done":
            return t["id"]
    return None

# ─── Roll-up logic ────────────────────────────────────────

async def check_and_rollup(
    base_url: str,
    auth_headers: dict,
    parent_key: str,
    rule_id: str,
    tenant_id: str,
    trigger_issue: str,
) -> dict:
    """Core roll-up: if all children are done, move parent to done"""
    start = datetime.utcnow()

    children = await get_issue_children(base_url, auth_headers, parent_key)

    if not children:
        return {"result": "skipped", "reason": "no children found", "parent": parent_key}

    all_done = all(
        c["fields"]["status"]["statusCategory"]["key"] == "done"
        for c in children
    )

    if not all_done:
        incomplete = [c["key"] for c in children if c["fields"]["status"]["statusCategory"]["key"] != "done"]
        return {
            "result": "skipped",
            "reason": f"{len(incomplete)} children still open",
            "incomplete": incomplete,
            "parent": parent_key,
        }

    # All children done — find and execute Done transition on parent
    transition_id = await find_done_transition(base_url, auth_headers, parent_key)
    if not transition_id:
        return {"result": "error", "reason": "No 'Done' transition found on parent", "parent": parent_key}

    success = await transition_issue(base_url, auth_headers, parent_key, transition_id)
    duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000)

    result = "rolled_up" if success else "error"
    details = {
        "parent": parent_key,
        "children_count": len(children),
        "transition_id": transition_id,
        "trigger": trigger_issue,
    }

    # Log to Supabase
    try:
        await supabase_post("automation_logs", {
            "rule_id": rule_id,
            "tenant_id": tenant_id,
            "trigger_issue": trigger_issue,
            "trigger_event": "issue_transitioned_to_done",
            "result": result,
            "details": details,
            "duration_ms": duration_ms,
        })
    except Exception as e:
        logger.warning(f"Failed to log automation result: {e}")

    return {"result": result, **details}

# ─── Webhook endpoints ────────────────────────────────────

@app.post("/webhook/{tenant_id}/{rule_id}")
async def handle_webhook(
    tenant_id: str,
    rule_id: str,
    request: Request,
    x_hub_signature: Optional[str] = Header(None),
):
    body_bytes = await request.body()

    # Verify HMAC signature if secret is set
    try:
        rules = await supabase_get(
            f"automation_rules?id=eq.{rule_id}&tenant_id=eq.{tenant_id}&select=*"
        )
        rule = rules[0] if rules else None
    except Exception:
        raise HTTPException(status_code=404, detail="Rule not found")

    if not rule or not rule.get("active"):
        return {"status": "ignored", "reason": "Rule not found or inactive"}

    if rule.get("webhook_secret") and x_hub_signature:
        expected = hmac.new(
            rule["webhook_secret"].encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(f"sha256={expected}", x_hub_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        event = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    issue_key = event.get("issue", {}).get("key")
    issue_type = event.get("issue", {}).get("fields", {}).get("issuetype", {}).get("name", "").lower()
    new_status_category = (
        event.get("changelog", {})
        .get("items", [{}])[0]
        .get("to", "")
    )

    if not issue_key:
        return {"status": "ignored", "reason": "No issue key in event"}

    logger.info(f"Webhook received: rule={rule_id} tenant={tenant_id} issue={issue_key} type={issue_type}")

    try:
        base_url, auth_headers = await get_jira_credentials(rule["jira_connection_id"])
    except Exception as e:
        logger.error(f"Failed to get credentials: {e}")
        raise HTTPException(status_code=500, detail="Credential retrieval failed")

    results = []

    # story_bug_to_epic: Story/Bug done → check Epic parent
    if rule["rule_type"] == "story_bug_to_epic" and issue_type in ["story", "bug", "user story"]:
        issue_data = await get_issue(base_url, auth_headers, issue_key)
        parent = (
            issue_data.get("fields", {}).get("parent") or
            issue_data.get("fields", {}).get("customfield_10014")  # Epic Link fallback
        )
        parent_key = parent.get("key") if isinstance(parent, dict) else None

        if parent_key:
            result = await check_and_rollup(
                base_url, auth_headers, parent_key,
                rule_id, tenant_id, issue_key,
            )
            results.append({"target": "epic", **result})

    # epic_to_initiative: Epic done → check Initiative parent
    elif rule["rule_type"] == "epic_to_initiative" and issue_type == "epic":
        issue_data = await get_issue(base_url, auth_headers, issue_key)
        parent = issue_data.get("fields", {}).get("parent")
        parent_key = parent.get("key") if isinstance(parent, dict) else None

        if parent_key:
            result = await check_and_rollup(
                base_url, auth_headers, parent_key,
                rule_id, tenant_id, issue_key,
            )
            results.append({"target": "initiative", **result})

    # Update last triggered
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/automation_rules?id=eq.{rule_id}",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={"last_triggered_at": datetime.utcnow().isoformat(), "trigger_count": rule.get("trigger_count", 0) + 1},
        )

    return {"status": "processed", "results": results}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "jiraforge-rollup", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"service": "JiraForge Roll-up Service", "docs": "/docs"}
