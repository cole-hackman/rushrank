# Backend TODOs - Implementation Complete

## Summary

All 4 missing backend endpoints have been implemented:

1. ✅ `POST /events/export` - Export attendance CSV
2. ✅ `POST /memberships/invite` - Invite member endpoint
3. ✅ `PUT /questionnaires/{id}` - Update questionnaire schema
4. ✅ `GET /tags/stats` - Tag usage statistics

## Implementation Details

### 1. Export Attendance CSV
**Endpoint**: `POST /events/export?chapter_id={id}`

**Location**: `python_server/routes.py` (line ~510)
**Service Method**: `EventService.export_attendance_csv()` in `python_server/services.py`

**Features**:
- Exports all event attendance for a chapter as CSV
- Includes: Event Name, Event Date, Location, PNM Name, PNM Email, Major, Checked In At, Checked In By
- Admin-only access
- Returns CSV file with proper headers

**Usage**:
```typescript
const response = await fetch(`/api/events/export?chapter_id=${chapterId}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const blob = await response.blob();
// Download blob as CSV file
```

---

### 2. Invite Member
**Endpoint**: `POST /memberships/invite?chapter_id={id}`

**Location**: `python_server/routes.py` (line ~85)
**Service Method**: Direct database query (no separate service method needed)

**Features**:
- Adds email to `email_allowlist` table
- Supports roles: `admin`, `member`, `observer`
- Maps frontend roles to database enum (`ADMIN`, `EXEC`, `BROTHER`)
- Admin-only access
- Handles duplicate emails (updates existing entry)

**Request Body**:
```json
{
  "email": "user@example.com",
  "role": "member"  // optional, defaults to "member"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invitation sent to user@example.com",
  "data": {
    "email": "user@example.com",
    "role": "member"
  }
}
```

**Usage**:
```typescript
await api('/memberships/invite?chapter_id=${chapterId}', {
  method: 'POST',
  body: { email: 'user@example.com', role: 'member' }
});
```

---

### 3. Update Questionnaire
**Endpoint**: `PUT /questionnaires/{questionnaire_id}?chapter_id={id}`

**Location**: `python_server/routes.py` (line ~603)
**Service Method**: `QuestionnaireService.update_questionnaire()` in `python_server/services.py`

**Features**:
- Updates questionnaire name, schema, and active status
- Verifies questionnaire belongs to chapter
- Admin-only access
- Returns updated questionnaire

**Request Body**:
```json
{
  "name": "Updated Questionnaire Name",
  "schema": {
    "questions": [
      {
        "id": "q1",
        "question": "What is your major?",
        "type": "text",
        "required": true
      }
    ]
  },
  "active": true
}
```

**Response**: Returns `Questionnaire` model with updated data

**Usage**:
```typescript
await api(`/questionnaires/${questionnaireId}?chapter_id=${chapterId}`, {
  method: 'PUT',
  body: {
    name: 'Updated Name',
    schema: { questions: [...] },
    active: true
  }
});
```

---

### 4. Tag Statistics
**Endpoint**: `GET /tags/stats?chapter_id={id}`

**Location**: `python_server/routes.py` (line ~518)
**Service Method**: `TagService.get_tag_statistics()` in `python_server/services.py`

**Features**:
- Returns tag usage statistics for a chapter
- Includes:
  - `total_tags`: Total number of tags
  - `most_used_tag`: Tag with highest usage count (or null if none)
  - `tagged_pnms_count`: Number of distinct PNMs with at least one tag
- Member access (any member can view stats)

**Response**:
```json
{
  "total_tags": 24,
  "most_used_tag": {
    "id": "tag-uuid",
    "label": "Leadership",
    "usage_count": 42
  },
  "tagged_pnms_count": 156
}
```

**Usage**:
```typescript
const stats = await api<{
  total_tags: number;
  most_used_tag: { id: string; label: string; usage_count: number } | null;
  tagged_pnms_count: number;
}>(`/tags/stats?chapter_id=${chapterId}`);
```

---

## Database Schema Notes

### Table Names
- **Attendance**: Uses `event_attendance` table (from migration)
- **Email Allowlist**: Uses `email_allowlist` table
- **Tags**: Uses `tags` and `pnm_tags` tables
- **Questionnaires**: Uses `questionnaires` table

### Role Mapping
Frontend roles map to database enum as follows:
- `admin` → `ADMIN`
- `member` → `EXEC` (executive committee)
- `observer` → `BROTHER`

---

## Testing Checklist

- [ ] Export attendance CSV downloads correctly
- [ ] Invite member adds email to allowlist
- [ ] Update questionnaire saves schema changes
- [ ] Tag statistics returns correct counts
- [ ] All endpoints require proper authentication
- [ ] Admin-only endpoints reject non-admin users
- [ ] Chapter membership is verified for all endpoints

---

## Files Modified

1. `python_server/routes.py` - Added 4 new endpoints
2. `python_server/services.py` - Added 3 new service methods:
   - `EventService.export_attendance_csv()`
   - `TagService.get_tag_statistics()`
   - `QuestionnaireService.update_questionnaire()`

---

## Next Steps

1. **Frontend Integration**: Update frontend to use these new endpoints
   - Events page: Wire export button to `/events/export`
   - Settings page: Wire invite button to `/memberships/invite`
   - Settings page: Wire questionnaire update to `PUT /questionnaires/{id}`
   - Tag Management: Wire stats cards to `/tags/stats`

2. **Email Sending**: The invite endpoint adds to allowlist but doesn't send email. Consider:
   - Integrating with Supabase Auth invite
   - Sending custom invitation email
   - Generating invite links/tokens

3. **Error Handling**: Add comprehensive error handling for edge cases

4. **Validation**: Add input validation for questionnaire schemas

---

## Notes

- All endpoints follow existing patterns in the codebase
- Authentication and authorization checks are in place
- Database queries use parameterized statements (SQL injection safe)
- Type hints and models are used throughout
- Error responses follow FastAPI conventions

