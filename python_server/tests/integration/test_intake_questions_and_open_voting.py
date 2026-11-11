"""
Intake questions and Open Voting, both broken until November 2026.

Intake questions: the service handed Python dicts to asyncpg for jsonb columns,
so saving a question or an answer always failed, and the read endpoint called
a method that did not exist. Open Voting: the tab's round was "the newest
active round", which could be a live session's.
"""

from __future__ import annotations

import json
import uuid

import pytest

from python_server import routes, services
from python_server.models import PNMAnswersCreate, QuestionnaireCreate

pytestmark = pytest.mark.integration

QUESTIONS = {
    "questions": [
        {"id": "q_1", "question": "Why this chapter?", "type": "textarea", "required": True},
        {"id": "q_2", "question": "Favourite class?", "type": "text", "required": False},
    ]
}


@pytest.mark.asyncio
async def test_questionnaire_saves_and_reads_back_as_a_dict(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.QuestionnaireService()

    created = await svc.create_questionnaire(
        str(seeded["chapter"]), QuestionnaireCreate(name="Intake", schema={"questions": []}, active=True)
    )
    assert created.schema == {"questions": []}

    updated = await svc.update_questionnaire(
        created.id, QuestionnaireCreate(name="Intake", schema=QUESTIONS, active=True)
    )
    assert updated.schema == QUESTIONS

    [listed] = await svc.list_questionnaires(str(seeded["chapter"]))
    assert listed.schema["questions"][0]["question"] == "Why this chapter?"


@pytest.mark.asyncio
async def test_answers_round_trip_with_question_text(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.QuestionnaireService()
    q = await svc.create_questionnaire(
        str(seeded["chapter"]), QuestionnaireCreate(name="Intake", schema=QUESTIONS, active=True)
    )

    saved = await svc.save_pnm_answers(
        str(seeded["pnm_a"]),
        PNMAnswersCreate(questionnaire_id=q.id, answers={
            "questionnaire-q_1": "The brotherhood",
            "questionnaire-q_2": "   ",  # blank answers are not stored
        }),
    )
    assert saved.answers == {"questionnaire-q_1": "The brotherhood"}

    [submission] = await svc.get_pnm_answers(str(seeded["pnm_a"]))
    assert submission["items"] == [
        {"key": "questionnaire-q_1", "question": "Why this chapter?", "answer": "The brotherhood"},
    ]


@pytest.mark.asyncio
async def test_answer_to_a_deleted_question_is_kept_and_labelled(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.QuestionnaireService()
    q = await svc.create_questionnaire(
        str(seeded["chapter"]), QuestionnaireCreate(name="Intake", schema=QUESTIONS, active=True)
    )
    await svc.save_pnm_answers(
        str(seeded["pnm_a"]),
        PNMAnswersCreate(questionnaire_id=q.id, answers={"questionnaire-q_2": "Statistics"}),
    )
    # The admin later deletes that question on Settings.
    await svc.update_questionnaire(
        q.id, QuestionnaireCreate(name="Intake", schema={"questions": QUESTIONS["questions"][:1]}, active=True)
    )

    [submission] = await svc.get_pnm_answers(str(seeded["pnm_a"]))
    assert submission["items"] == [
        {"key": "questionnaire-q_2", "question": "(question removed)", "answer": "Statistics"},
    ]


@pytest.mark.asyncio
async def test_public_answers_keep_only_known_questions(seeded, db_manager, db, monkeypatch):
    """The public form is unauthenticated, so unknown keys are dropped."""
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.QuestionnaireService()
    await svc.create_questionnaire(
        str(seeded["chapter"]), QuestionnaireCreate(name="Intake", schema=QUESTIONS, active=True)
    )

    kept = await svc.save_public_answers(str(seeded["chapter"]), str(seeded["pnm_b"]), {
        "questionnaire-q_1": "x" * 5000,
        "questionnaire-made_up": "spam",
        "anything": "spam",
    })

    assert kept == 1
    stored = await db.fetchval("SELECT answers FROM pnm_answers WHERE pnm_id = $1", seeded["pnm_b"])
    stored = json.loads(stored)
    assert list(stored) == ["questionnaire-q_1"]
    assert len(stored["questionnaire-q_1"]) == services.MAX_ANSWER_LENGTH


@pytest.mark.asyncio
async def test_public_question_list_exposes_only_question_fields(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.QuestionnaireService()
    assert await svc.get_active_questions(str(seeded["chapter"])) is None

    schema = {"questions": [dict(QUESTIONS["questions"][0], internal_note="do not leak")]}
    await svc.create_questionnaire(
        str(seeded["chapter"]), QuestionnaireCreate(name="Intake", schema=schema, active=True)
    )
    active = await svc.get_active_questions(str(seeded["chapter"]))
    assert active["questions"] == [
        {"id": "q_1", "question": "Why this chapter?", "type": "textarea", "required": True}
    ]


@pytest.mark.asyncio
async def test_open_round_ignores_rounds_with_a_live_session(seeded, db):
    """The Open Voting tab must never hand out a live session's round."""
    chapter = seeded["chapter"]
    # The seeded round is ACTIVE and GENERAL with no session: it is the open round.
    row = await db.fetchrow(routes.OPEN_ROUND_SQL, chapter)
    assert row["id"] == seeded["round"]

    # A newer round driven by a live session must not take its place.
    session_round = uuid.uuid4()
    await db.execute(
        """INSERT INTO voting_rounds (id, chapter_id, type, status, room_code, created_at)
           VALUES ($1, $2, 'GENERAL', 'ACTIVE', 'LIVE99', now() + interval '1 minute')""",
        session_round, chapter,
    )
    await db.execute(
        "INSERT INTO sessions (round_id, join_code, locked, started_at) VALUES ($1, 'LIVE99', false, now())",
        session_round,
    )
    row = await db.fetchrow(routes.OPEN_ROUND_SQL, chapter)
    assert row["id"] == seeded["round"]

    # An ended session still disqualifies its round.
    await db.execute("UPDATE sessions SET ended_at = now() WHERE round_id = $1", session_round)
    row = await db.fetchrow(routes.OPEN_ROUND_SQL, chapter)
    assert row["id"] == seeded["round"]

    # With no sessionless active round, there is no open round.
    await db.execute("UPDATE voting_rounds SET status = 'ENDED' WHERE id = $1", seeded["round"])
    assert await db.fetchrow(routes.OPEN_ROUND_SQL, chapter) is None
