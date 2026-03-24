# ============================================================
# Tests for JiraForge Roll-up Service
# Run: pytest test_main.py -v
# ============================================================

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient
from fastapi.testclient import TestClient

# Set env vars before importing app
import os
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "test-service-key"
os.environ["JIRAFORGE_API_URL"] = "https://jiraforge.test"
os.environ["INTERNAL_API_KEY"] = "test-internal-key"

from main import app, check_and_rollup, find_done_transition, get_issue_children

client = TestClient(app)


# ─── Health & Root ───────────────────────────────────────────
class TestHealthEndpoints:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "jiraforge-rollup"

    def test_root_endpoint(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "JiraForge" in data["service"]


# ─── get_issue_children (new search/jql endpoint) ───────────
class TestGetIssueChildren:
    @pytest.mark.anyio
    async def test_fetches_children_from_search_jql_endpoint(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "issues": [
                {"key": "PROJ-2", "fields": {"status": {"statusCategory": {"key": "done"}}}},
                {"key": "PROJ-3", "fields": {"status": {"statusCategory": {"key": "indeterminate"}}}},
            ],
            # No nextPageToken = single page
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_instance

            children = await get_issue_children(
                "https://test.atlassian.net",
                {"Authorization": "Basic abc"},
                "PROJ-1",
            )

            assert len(children) == 2
            assert children[0]["key"] == "PROJ-2"
            # Verify it calls the new /search/jql endpoint
            call_args = mock_instance.get.call_args
            assert "/search/jql" in call_args[0][0]

    @pytest.mark.anyio
    async def test_handles_pagination_with_nextPageToken(self):
        page1 = MagicMock()
        page1.status_code = 200
        page1.raise_for_status = MagicMock()
        page1.json.return_value = {
            "issues": [{"key": "PROJ-2", "fields": {}}],
            "nextPageToken": "token-page-2",
        }

        page2 = MagicMock()
        page2.status_code = 200
        page2.raise_for_status = MagicMock()
        page2.json.return_value = {
            "issues": [{"key": "PROJ-3", "fields": {}}],
            # No nextPageToken = last page
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_instance = AsyncMock()
            mock_instance.get.side_effect = [page1, page2]
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_instance

            children = await get_issue_children(
                "https://test.atlassian.net",
                {"Authorization": "Basic abc"},
                "PROJ-1",
            )

            assert len(children) == 2
            assert mock_instance.get.call_count == 2
            # Second call should include nextPageToken
            second_call_params = mock_instance.get.call_args_list[1][1]["params"]
            assert second_call_params["nextPageToken"] == "token-page-2"


# ─── find_done_transition ───────────────────────────────────
class TestFindDoneTransition:
    @pytest.mark.anyio
    async def test_finds_done_transition(self):
        transitions = [
            {"id": "1", "to": {"statusCategory": {"key": "indeterminate"}}},
            {"id": "2", "to": {"statusCategory": {"key": "done"}}},
        ]

        with patch("main.get_transitions", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = transitions
            result = await find_done_transition("url", {}, "PROJ-1")
            assert result == "2"

    @pytest.mark.anyio
    async def test_returns_none_when_no_done_transition(self):
        transitions = [
            {"id": "1", "to": {"statusCategory": {"key": "indeterminate"}}},
        ]

        with patch("main.get_transitions", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = transitions
            result = await find_done_transition("url", {}, "PROJ-1")
            assert result is None


# ─── check_and_rollup ───────────────────────────────────────
class TestCheckAndRollup:
    @pytest.mark.anyio
    async def test_skips_when_no_children(self):
        with patch("main.get_issue_children", new_callable=AsyncMock) as mock_children:
            mock_children.return_value = []

            result = await check_and_rollup("url", {}, "PROJ-1", "r1", "t1", "PROJ-2")
            assert result["result"] == "skipped"
            assert "no children" in result["reason"]

    @pytest.mark.anyio
    async def test_skips_when_not_all_children_done(self):
        children = [
            {"key": "PROJ-2", "fields": {"status": {"statusCategory": {"key": "done"}}}},
            {"key": "PROJ-3", "fields": {"status": {"statusCategory": {"key": "indeterminate"}}}},
        ]

        with patch("main.get_issue_children", new_callable=AsyncMock) as mock_children, \
             patch("main.supabase_post", new_callable=AsyncMock):
            mock_children.return_value = children

            result = await check_and_rollup("url", {}, "PROJ-1", "r1", "t1", "PROJ-2")
            assert result["result"] == "skipped"
            assert "1 children still open" in result["reason"]
            assert "PROJ-3" in result["incomplete"]

    @pytest.mark.anyio
    async def test_rolls_up_when_all_children_done(self):
        children = [
            {"key": "PROJ-2", "fields": {"status": {"statusCategory": {"key": "done"}}}},
            {"key": "PROJ-3", "fields": {"status": {"statusCategory": {"key": "done"}}}},
        ]

        with patch("main.get_issue_children", new_callable=AsyncMock) as mock_children, \
             patch("main.find_done_transition", new_callable=AsyncMock) as mock_transition, \
             patch("main.transition_issue", new_callable=AsyncMock) as mock_do_transition, \
             patch("main.supabase_post", new_callable=AsyncMock):
            mock_children.return_value = children
            mock_transition.return_value = "5"
            mock_do_transition.return_value = True

            result = await check_and_rollup("url", {}, "PROJ-1", "r1", "t1", "PROJ-2")
            assert result["result"] == "rolled_up"
            assert result["children_count"] == 2
            mock_do_transition.assert_called_once_with("url", {}, "PROJ-1", "5")

    @pytest.mark.anyio
    async def test_returns_error_when_no_done_transition(self):
        children = [
            {"key": "PROJ-2", "fields": {"status": {"statusCategory": {"key": "done"}}}},
        ]

        with patch("main.get_issue_children", new_callable=AsyncMock) as mock_children, \
             patch("main.find_done_transition", new_callable=AsyncMock) as mock_transition, \
             patch("main.supabase_post", new_callable=AsyncMock):
            mock_children.return_value = children
            mock_transition.return_value = None

            result = await check_and_rollup("url", {}, "PROJ-1", "r1", "t1", "PROJ-2")
            assert result["result"] == "error"
            assert "No 'Done' transition" in result["reason"]


# ─── Webhook endpoint ───────────────────────────────────────
class TestWebhookEndpoint:
    def test_returns_ignored_for_inactive_rule(self):
        with patch("main.supabase_get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = [{"id": "r1", "active": False}]

            response = client.post(
                "/webhook/t1/r1",
                json={"issue": {"key": "PROJ-1"}},
            )
            assert response.status_code == 200
            assert response.json()["status"] == "ignored"

    def test_returns_ignored_when_no_issue_key(self):
        with patch("main.supabase_get", new_callable=AsyncMock) as mock_get, \
             patch("main.get_jira_credentials", new_callable=AsyncMock) as mock_creds, \
             patch("httpx.AsyncClient") as mock_http:
            mock_get.return_value = [{"id": "r1", "active": True, "rule_type": "story_bug_to_epic", "jira_connection_id": "c1"}]
            mock_http_instance = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_http_instance)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)

            response = client.post(
                "/webhook/t1/r1",
                json={"changelog": {}},  # no issue key
            )
            assert response.status_code == 200
            assert response.json()["status"] == "ignored"

    def test_returns_400_for_invalid_json(self):
        with patch("main.supabase_get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = [{"id": "r1", "active": True}]

            response = client.post(
                "/webhook/t1/r1",
                content=b"not-json{{{",
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 400
