"""Run against a disposable PostgreSQL container, never a hosted database.

Usage:
    python tests/economy_integration.py [container-name]
"""

import concurrent.futures
import json
import pathlib
import subprocess
import sys
import uuid


ROOT = pathlib.Path(__file__).resolve().parents[1]

CONTAINER = (
    sys.argv[1]
    if len(sys.argv) > 1
    else "pcgh-test-db"
)

DB = "pcgh_economy_test"


def command(args, **kwargs):
    return subprocess.run(
        args,
        text=True,
        capture_output=True,
        **kwargs,
    )


def sql(statement, fail=False):
    result = command(
        [
            "docker",
            "exec",
            "-i",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            DB,
            "-At",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=statement,
    )

    if fail:
        assert result.returncode != 0, (
            "Expected rejection: " + statement
        )
        return result.stderr

    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def val(statement):
    return sql(statement).splitlines()[-1]


def auth(user, statement, fail=False):
    return sql(
        "SET ROLE authenticated; "
        f"SET request.jwt.claim.sub='{user}'; "
        + statement,
        fail,
    )


def rpc(user, act, payload=None, fail=False):
    encoded = json.dumps(
        payload or {}
    ).replace("'", "''")

    output = auth(
        user,
        "SELECT campaign_action("
        f"'{act}','{encoded}'::jsonb"
        ");",
        fail,
    )

    if fail:
        return output

    return json.loads(
        output.splitlines()[-1]
    )


def uid(number):
    return str(
        uuid.UUID(int=number)
    )


command(
    [
        "docker",
        "exec",
        CONTAINER,
        "dropdb",
        "-U",
        "postgres",
        "--if-exists",
        DB,
    ],
    check=True,
)

command(
    [
        "docker",
        "exec",
        CONTAINER,
        "createdb",
        "-U",
        "postgres",
        DB,
    ],
    check=True,
)

sql(
    (ROOT / "tests/bootstrap.sql").read_text()
)

sql(
    (
        ROOT
        / "supabase/migrations"
        / "20260205210034_001_create_core_schema.sql"
    ).read_text()
)

sql(
    "ALTER TABLE users "
    "ADD COLUMN is_admin boolean DEFAULT false,"
    "ADD COLUMN admin_role text,"
    "ADD COLUMN admin_pin text;"
)

sql(
    (
        ROOT
        / "supabase/migrations"
        / "20260207103155_011_create_ads_campaigns_safe.sql"
    ).read_text()
)

# Pre-existing balances and campaigns must survive the new migration.
sql(
    f"""
    INSERT INTO auth.users(id,email)
    VALUES(
        '{uid(109)}',
        'legacy@test.invalid'
    );

    INSERT INTO users(
        id,email,username,credits
    )
    VALUES(
        '{uid(109)}',
        'legacy@test.invalid',
        'legacy',
        765.5
    );

    INSERT INTO links(
        user_id,
        url,
        link_type,
        title,
        target_engagement,
        credits_spent
    )
    VALUES(
        '{uid(109)}',
        'https://example.org',
        'website',
        'Legacy',
        50,
        60
    );

    INSERT INTO ad_campaigns(
        user_id,
        name,
        platform,
        objective,
        start_date
    )
    VALUES(
        '{uid(109)}',
        'Old ad plan',
        'facebook',
        'traffic',
        CURRENT_DATE
    );
    """
)

sql(
    (
        ROOT
        / "supabase/migrations"
        / "20261117000000_fixed_campaign_economy.sql"
    ).read_text()
)

assert val(
    "SELECT credits FROM users "
    f"WHERE id='{uid(109)}';"
) == "765.5"

assert val(
    "SELECT amount FROM wallet_events "
    f"WHERE user_id='{uid(109)}' "
    "AND kind='opening_balance';"
) == "765.5"

assert val(
    "SELECT target_engagement||','||credits_spent "
    "FROM links WHERE title='Legacy';"
) == "50,60"

assert val(
    "SELECT title FROM ad_campaigns "
    "WHERE name='Old ad plan';"
) == "Old ad plan"

sql(
    "GRANT ALL ON ALL TABLES IN SCHEMA public "
    "TO service_role; "
    "GRANT USAGE,SELECT "
    "ON ALL SEQUENCES IN SCHEMA public "
    "TO service_role;"
)

owner = uid(1)
worker = uid(2)
admin = uid(3)

sql(
    "\n".join(
        (
            "INSERT INTO auth.users(id,email) "
            f"VALUES('{uid(i)}','u{i}@test.invalid'); "
            "INSERT INTO users("
            "id,email,username,credits,"
            "earning_allowance,earning_unlocked"
            ") "
            f"VALUES('{uid(i)}','u{i}@test.invalid',"
            f"'user_{i}',1000,200,200);"
        )
        for i in range(1, 108)
    )
)

sql(
    f"""
    UPDATE users
    SET is_admin=true,admin_role='owner'
    WHERE id='{admin}';

    INSERT INTO admin_sessions(
        user_id,pin_hash
    )
    VALUES(
        '{admin}',
        extensions.crypt(
            '654321',
            extensions.gen_salt('bf')
        )
    );
    """
)

assert "error" in rpc(
    admin,
    "admin_login",
    {"pin": "wrong"},
)

assert rpc(
    admin,
    "admin_login",
    {"pin": "654321"},
)["ok"]

# Ad plans save against the historical name-based schema
# plus the compatibility columns.
sql(
    "GRANT SELECT,INSERT,UPDATE,DELETE "
    "ON ad_campaigns TO authenticated;"
)

auth(
    worker,
    """
    INSERT INTO ad_campaigns(
        user_id,
        name,
        title,
        platform,
        objective,
        budget,
        currency,
        start_date
    )
    VALUES(
        auth.uid(),
        'New plan',
        'New plan',
        'facebook',
        'traffic',
        1000,
        'NGN',
        CURRENT_DATE
    );
    """,
)

assert auth(
    worker,
    "SELECT count(*) FROM ad_campaigns;",
).splitlines()[-1] == "1"

# Browser financial writes and escalation are blocked,
# while own profile editing works.
assert "permission denied" in auth(
    worker,
    "UPDATE users SET credits=99999;",
    True,
)

assert "permission denied" in auth(
    worker,
    "UPDATE users SET is_admin=true;",
    True,
)

assert "permission denied" in auth(
    worker,
    "SELECT admin_pin FROM users;",
    True,
)

auth(
    worker,
    "UPDATE users SET full_name='Member Two' "
    "WHERE id=auth.uid();",
)

assert auth(
    worker,
    "SELECT count(*) FROM users;",
).splitlines()[-1] == "1"

rpc(
    worker,
    "approve",
    {"campaign_id": uid(900)},
    True,
)

# Submission is idempotent and reserve/charge
# do not double debit.
payload = {
    "request_id": uid(500),
    "title": "Test campaign",
    "url": "https://example.com",
    "platform": "website",
    "instructions": (
        "Visit and provide useful evidence"
    ),
    "task_type": "feedback",
}

campaign = rpc(
    owner,
    "submit",
    payload,
)

cid = campaign["id"]

assert rpc(
    owner,
    "submit",
    payload,
)["id"] == cid

assert val(
    "SELECT credits||','||reserved_credits "
    f"FROM users WHERE id='{owner}';"
) == "500,500"

rpc(
    admin,
    "approve",
    {"campaign_id": cid},
)

assert val(
    "SELECT credits||','||reserved_credits"
    "||','||earning_allowance "
    f"FROM users WHERE id='{owner}';"
) == "500,0,400"

rpc(
    admin,
    "approve",
    {"campaign_id": cid},
    True,
)

rpc(
    owner,
    "start",
    {"campaign_id": cid},
    True,
)

# Worker can earn exactly two credits,
# with reservations preventing oversubscription.
sql(
    "UPDATE users "
    "SET earning_allowance=2,earning_unlocked=2 "
    f"WHERE id='{worker}';"
)

claim = rpc(
    worker,
    "start",
    {"campaign_id": cid},
)

assert rpc(
    worker,
    "start",
    {"campaign_id": cid},
)["id"] == claim["id"]

rpc(
    admin,
    "review",
    {
        "claim_id": claim["id"],
        "approved": True,
    },
    True,
)

rpc(
    worker,
    "evidence",
    {
        "claim_id": claim["id"],
        "evidence": (
            "Completed feedback: "
            "the navigation was clear."
        ),
    },
)

assert auth(
    owner,
    "SELECT pending_claims "
    "FROM campaign_progress() "
    f"WHERE campaign_id='{cid}';",
).splitlines()[-1] == "1"

assert auth(
    worker,
    "SELECT count(*) "
    "FROM campaign_progress();",
).splitlines()[-1] == "0"

rpc(
    admin,
    "review",
    {
        "claim_id": claim["id"],
        "approved": True,
    },
)

rpc(
    admin,
    "review",
    {
        "claim_id": claim["id"],
        "approved": True,
    },
    True,
)

assert val(
    "SELECT credits||','||earning_allowance"
    "||','||earning_reserved "
    f"FROM users WHERE id='{worker}';"
) == "1002,0,0"

# Second campaign, rejected reservation,
# allowance exhaustion.
payload["request_id"] = uid(501)

c2 = rpc(
    owner,
    "submit",
    payload,
)["id"]

rpc(
    admin,
    "reject",
    {
        "campaign_id": c2,
        "reason": "Unsupported content",
    },
)

assert val(
    "SELECT credits||','||reserved_credits "
    f"FROM users WHERE id='{owner}';"
) == "500,0"

payload["request_id"] = uid(502)

c3 = rpc(
    owner,
    "submit",
    payload,
)["id"]

rpc(
    admin,
    "approve",
    {"campaign_id": c3},
)

rpc(
    worker,
    "start",
    {"campaign_id": c3},
    True,
)

# A short allowance reserves across different campaigns,
# not just one claim.
sql(
    "UPDATE users SET earning_allowance=2 "
    f"WHERE id='{uid(4)}';"
)

q4 = rpc(
    uid(4),
    "start",
    {"campaign_id": cid},
)

rpc(
    uid(4),
    "start",
    {"campaign_id": c3},
    True,
)

# Expired assignment releases earning reservation.
# Evidence cannot be submitted late.
sql(
    "UPDATE campaign_claims "
    "SET deadline=now()-interval '1 second' "
    f"WHERE id='{q4['id']}';"
)

rpc(
    uid(4),
    "refresh",
)

assert val(
    "SELECT earning_reserved FROM users "
    f"WHERE id='{uid(4)}';"
) == "0"

rpc(
    uid(4),
    "evidence",
    {
        "claim_id": q4["id"],
        "evidence": "Too late evidence text",
    },
    True,
)

# Parallel claim attempts cannot exceed 100 slots,
# including the verified claim.
def start(number):
    try:
        return rpc(
            uid(number),
            "start",
            {"campaign_id": cid},
        )
    except AssertionError:
        return None


with concurrent.futures.ThreadPoolExecutor(
    max_workers=12
) as pool:
    results = list(
        pool.map(
            start,
            range(5, 108),
        )
    )

assert sum(
    result is not None
    for result in results
) == 99

assert val(
    "SELECT count(*) FROM campaign_claims "
    f"WHERE campaign_id='{cid}' "
    "AND status IN ("
    "'in_progress',"
    "'pending_verification',"
    "'verified'"
    ");"
) == "100"

# Verify all 99 remaining claims.
# Completion closes automatically;
# exact reward conservation.
for result in filter(None, results):
    rpc(
        result["user_id"],
        "evidence",
        {
            "claim_id": result["id"],
            "evidence": (
                "Useful task completion "
                "evidence recorded."
            ),
        },
    )

    rpc(
        admin,
        "review",
        {
            "claim_id": result["id"],
            "approved": True,
        },
    )

assert val(
    "SELECT status||','||distributed"
    "||','||refunded "
    f"FROM campaigns WHERE id='{cid}';"
) == "completed,200,0"

assert val(
    "SELECT sum(amount) FROM wallet_events "
    f"WHERE campaign_id='{cid}' "
    "AND kind='reward';"
) == "200"

# Distribution and account state are server-enforced,
# and admins cannot review themselves.
rpc(
    admin,
    "distribute",
    {
        "campaign_id": c3,
        "audience": "individuals",
        "recipients": [uid(5)],
    },
)

rpc(
    uid(6),
    "start",
    {"campaign_id": c3},
    True,
)

rpc(
    admin,
    "distribute",
    {
        "campaign_id": c3,
        "audience": "community",
    },
)

rpc(
    admin,
    "access",
    {
        "user_id": uid(6),
        "is_active": False,
    },
)

rpc(
    uid(6),
    "refresh",
    fail=True,
)

rpc(
    admin,
    "access",
    {
        "user_id": uid(6),
        "is_active": True,
    },
)

qa = rpc(
    admin,
    "start",
    {"campaign_id": c3},
)

rpc(
    admin,
    "evidence",
    {
        "claim_id": qa["id"],
        "evidence": (
            "Admin participant "
            "completion evidence."
        ),
    },
)

rpc(
    admin,
    "review",
    {
        "claim_id": qa["id"],
        "approved": True,
    },
    True,
)

rpc(
    admin,
    "manage_admin",
    {
        "user_id": uid(106),
        "enabled": True,
        "pin": "987654",
    },
)

assert rpc(
    uid(106),
    "admin_login",
    {"pin": "987654"},
)["ok"]

rpc(
    uid(106),
    "review",
    {
        "claim_id": qa["id"],
        "approved": False,
        "reason": "Evidence not sufficient",
    },
)

rpc(
    admin,
    "manage_admin",
    {
        "user_id": uid(106),
        "enabled": False,
    },
)

rpc(
    uid(106),
    "approve",
    {"campaign_id": c3},
    True,
)

# Pending evidence survives campaign expiry.
# Settlement waits, then returns unused rewards once.
q5 = rpc(
    uid(5),
    "start",
    {"campaign_id": c3},
)

rpc(
    uid(5),
    "evidence",
    {
        "claim_id": q5["id"],
        "evidence": (
            "Evidence submitted before "
            "the campaign deadline."
        ),
    },
)

sql(
    "UPDATE campaigns "
    "SET expires_at=now()-interval '1 second' "
    f"WHERE id='{c3}';"
)

rpc(
    admin,
    "refresh",
)

assert val(
    "SELECT status FROM campaigns "
    f"WHERE id='{c3}';"
) == "settling"

rpc(
    admin,
    "settle",
    {"campaign_id": c3},
    True,
)

rpc(
    admin,
    "review",
    {
        "claim_id": q5["id"],
        "approved": False,
        "reason": "Evidence not sufficient",
    },
)

assert val(
    "SELECT status||','||refunded "
    f"FROM campaigns WHERE id='{c3}';"
) == "expired,200"

rpc(
    admin,
    "settle",
    {"campaign_id": c3},
)

assert val(
    "SELECT count(*) FROM wallet_events "
    f"WHERE campaign_id='{c3}' "
    "AND kind='refund';"
) == "1"

# Payment settlement is atomic/idempotent.
# No browser access or metadata-based grants.
sql(
    "INSERT INTO credit_orders("
    "reference,user_id,credits,amount_naira"
    ") "
    f"VALUES('test-order','{owner}',300,300);"
)

auth(
    worker,
    "SELECT settle_credit_order("
    "'test-order','42',300,'NGN'"
    ");",
    True,
)

sql(
    "SELECT settle_credit_order("
    "'test-order','42',299,'NGN'"
    ");",
    True,
)

sql(
    "SELECT settle_credit_order("
    "'test-order','42',300,NULL"
    ");",
    True,
)

assert json.loads(
    val(
        "SELECT settle_credit_order("
        "'test-order','42',300,'NGN'"
        ");"
    )
)["ok"]

assert json.loads(
    val(
        "SELECT settle_credit_order("
        "'test-order','42',300,'NGN'"
        ");"
    )
)["duplicate"]

assert val(
    "SELECT count(*) FROM wallet_events "
    "WHERE reference='test-order';"
) == "1"

# PIN throttling persists across failed RPC responses.
for _ in range(5):
    assert "error" in rpc(
        admin,
        "admin_login",
        {"pin": "wrong"},
    )

assert "Too many attempts" in rpc(
    admin,
    "admin_login",
    {"pin": "654321"},
)["error"]

print(
    "PASS: reservations, approval/rejection, "
    "authorization, duplicate protection, earning caps, "
    "expired assignments, 103 concurrent starts, "
    "100 verified payouts, expiry settlement, "
    "payment retries, PIN throttling."
)
