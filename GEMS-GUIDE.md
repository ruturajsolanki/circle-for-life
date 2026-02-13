# Quick Gem Boost Guide

## Level Thresholds

| Level | Title       | Gems Needed |
|-------|-------------|-------------|
| 1     | Newcomer    | 0           |
| 2     | Explorer    | 50          |
| 3     | Creator     | 200         |
| 4     | Influencer  | 500         |
| 5     | Champion    | 1,500       |
| 6     | Legend      | 5,000       |
| 7     | Mythic      | 15,000      |
| 8     | Titan       | 30,000      |
| 9     | Ascendant   | 50,000      |
| 10    | Eternal     | 100,000     |

---

## Option 1: Admin Panel (UI)

1. Login as `admin@circleforlife.app` / `admin123456`
2. Go to **Users** in the sidebar
3. Find the user, click **Gems** button
4. Enter amount (e.g. `100000`) and reason
5. Done — user is instantly Level 10

---

## Option 2: cURL (fastest)

### Add gems to a user

```bash
# First get a token
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@circleforlife.app","password":"admin123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['accessToken'])")

# Add 100,000 gems to a user (replace USER_ID)
curl -X POST http://localhost:3000/v1/manage/users/USER_ID/gems \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 100000, "reason": "testing"}'
```

### Set a user to a specific level directly

```bash
curl -X POST http://localhost:3000/v1/manage/users/USER_ID/set-level \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"level": 10, "reason": "testing"}'
```

### Boost the admin account itself to Level 10

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@circleforlife.app","password":"admin123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['accessToken'])")

curl -X POST http://localhost:3000/v1/manage/users/usr_admin_001/set-level \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"level": 10, "reason": "admin boost"}'
```

---

## Option 3: Direct Supabase SQL

```sql
-- Set any user to Level 10 (100k gems)
UPDATE users
SET gem_balance = 100000,
    total_gems_earned = 100000,
    updated_at = NOW()
WHERE email = 'admin@circleforlife.app';
```

---

## Notes

- `totalGemsEarned` determines the level, not `gemBalance`
- Admin/super_admin roles bypass all level gates regardless of gems
- After boosting via API, the user needs to **re-login** to see the updated level in the UI
