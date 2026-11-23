"""A stand-in for the Supabase Auth admin API, for tests that must not reach one."""

import json
import uuid

import httpx


class FakeAuth:
    """`filters=False` returns every account whatever is asked, newest first."""

    def __init__(self, emails=(), filters=True, page_size=2, status=200):
        self.users = [{"id": str(uuid.uuid4()), "email": e, "app_metadata": {}} for e in emails]
        self.filters, self.page_size, self.status = filters, page_size, status
        self.created, self.updated = [], []

    def id_of(self, email):
        return next(u["id"] for u in self.users if u["email"] == email)

    def __call__(self, request):
        assert request.url.host == "auth.example.invalid", request.url
        if request.method == "GET":
            q = request.url.params
            users = self.users
            if self.filters and q.get("filter"):
                users = [u for u in users if q["filter"] in u["email"]]
            start = (int(q.get("page", 1)) - 1) * self.page_size
            return httpx.Response(self.status, json={"users": users[start:start + self.page_size]})
        body = json.loads(request.content)
        if request.method == "POST":
            user = {"id": str(uuid.uuid4()), "email": body["email"], "app_metadata": body.get("app_metadata", {})}
            self.users.insert(0, user)
            self.created.append(body)
            return httpx.Response(200, json=user)
        self.updated.append((request.url.path.rsplit("/", 1)[-1], body))
        return httpx.Response(200, json={})

    def patch(self, monkeypatch, module):
        real = httpx.AsyncClient
        monkeypatch.setattr(
            module, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(self), **kw)
        )
