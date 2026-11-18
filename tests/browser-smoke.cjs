// Authenticated UI checks with a mocked Supabase transport;
// economy invariants are tested against real PostgreSQL
// in economy_integration.py, not these fixtures.

const {
  chromium,
} = require("playwright");

const assert = require(
  "node:assert/strict",
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });

  const context =
    await browser.newContext({
      viewport: {
        width: 1440,
        height: 1000,
      },
    });

  const user = {
    id:
      "00000000-0000-0000-0000-000000000001",
    email: "member@test.invalid",
    username: "member",
    full_name: "Test Member",
    credits: 1000,
    reserved_credits: 0,
    earning_allowance: 200,
    earning_unlocked: 200,
    earning_reserved: 0,
    is_admin: true,
    admin_role: "owner",
    is_active: true,
    completed_tasks_count: 0,
    total_earned_credits: 0,
    total_spent_credits: 0,
    joined_at:
      new Date().toISOString(),
    email_confirmed_at:
      new Date().toISOString(),
  };

  const campaign = {
    id:
      "00000000-0000-0000-0000-000000000900",
    user_id:
      "00000000-0000-0000-0000-000000000002",
    title: "Community feedback",
    url: "https://example.com",
    platform: "website",
    instructions:
      "Visit the content and provide specific useful feedback.",
    task_type: "feedback",
    status: "active",
    verified_count: 0,
    target: 100,
    reward: 2,
    distributed: 0,
    refunded: 0,
    created_at:
      new Date().toISOString(),
    approved_at:
      new Date().toISOString(),
    expires_at: new Date(
      Date.now() + 86400000 * 7,
    ).toISOString(),
  };

  let campaigns = [campaign];
  let claims = [];
  let submitted = false;

  await context.addInitScript(
    ({ user }) =>
      localStorage.setItem(
        "sb-pcgh-test-auth-token",
        JSON.stringify({
          access_token:
            "test.access.token",
          refresh_token:
            "test-refresh",
          expires_at:
            Math.floor(
              Date.now() / 1000,
            ) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      ),
    { user },
  );

  await context.route(
    "https://pcgh-test.supabase.co/**",
    async (route) => {
      const request =
        route.request();

      const url = new URL(
        request.url(),
      );

      let data = [];

      if (
        url.pathname ===
        "/auth/v1/user"
      ) {
        data = user;
      } else if (
        url.pathname.includes(
          "/rpc/",
        )
      ) {
        const rpc = url.pathname
          .split("/")
          .pop();

        const body =
          request.postDataJSON();

        data =
          rpc === "campaign_admin"
            ? true
            : rpc ===
                "campaign_progress"
              ? []
              : { ok: true };

        if (
          body?.action === "submit"
        ) {
          submitted = true;

          campaigns.push({
            ...campaign,
            ...body.payload,
            id:
              "submitted-campaign",
            user_id: user.id,
            status:
              "pending_approval",
            expires_at: null,
            approved_at: null,
          });

          user.credits -= 500;
          user.reserved_credits +=
            500;
        }

        if (
          body?.action === "start"
        ) {
          data = {
            id: "claim-one",
            campaign_id:
              campaign.id,
            user_id: user.id,
            status:
              "in_progress",
            deadline: new Date(
              Date.now() +
                1800000,
            ).toISOString(),
          };

          claims.push(data);
          user.earning_reserved = 2;
        }

        if (
          body?.action ===
          "evidence"
        ) {
          claims[0].status =
            "pending_verification";
        }
      } else if (
        url.pathname.includes(
          "/rest/v1/users",
        )
      ) {
        data =
          request.headers()[
            "accept"
          ]?.includes("object")
            ? user
            : [user];
      } else if (
        url.pathname.endsWith(
          "/campaigns",
        )
      ) {
        data = campaigns.filter(
          (item) =>
            !url.searchParams.get(
              "user_id",
            ) ||
            url.searchParams.get(
              "user_id",
            ) ===
              `eq.${item.user_id}`,
        );
      } else if (
        url.pathname.endsWith(
          "/campaign_claims",
        )
      ) {
        data = claims;
      }

      await route.fulfill({
        status: 200,
        contentType:
          "application/json",
        headers: {
          "Access-Control-Allow-Origin":
            "*",
        },
        body: JSON.stringify(data),
      });
    },
  );

  const page =
    await context.newPage();

  const errors = [];

  page.on(
    "pageerror",
    (error) =>
      errors.push(
        error.message,
      ),
  );

  const go = async (path) => {
    await page.goto(
      "http://127.0.0.1:5174" +
        path,
    );

    await page
      .getByRole("heading", {
        level: 1,
      })
      .waitFor();

    await page.waitForTimeout(200);
  };

  await go("/");

  await page
    .getByText(
      "Welcome back, Test Member",
    )
    .waitFor();

  assert.equal(
    await page
      .getByText(
        "Each campaign costs 500 credits",
        { exact: false },
      )
      .count(),
    1,
  );

  await go("/buy-credits");

  await page
    .getByRole("button", {
      name: "Pay ₦500",
      exact: true,
    })
    .waitFor();

  await page
    .getByRole("button", {
      name: "Pay ₦300",
      exact: true,
    })
    .waitFor();

  await go("/submit");

  await page
    .getByLabel(
      "Destination URL",
    )
    .fill(
      "https://example.org",
    );

  await page
    .getByLabel(
      "Campaign Title",
    )
    .fill(
      "My new campaign",
    );

  await page
    .getByLabel(
      "Task Instructions",
    )
    .fill(
      "Read the article and give useful feedback.",
    );

  await page
    .getByRole("button", {
      name:
        "Submit for Review — 500 Credits",
    })
    .click();

  await page
    .getByRole("status")
    .filter({
      hasText:
        "Campaign submitted",
    })
    .waitFor();

  assert.ok(submitted);

  await go("/links");

  await page
    .getByRole("heading", {
      name:
        "My new campaign",
    })
    .waitFor();

  await go("/tasks");

  await page
    .getByRole("button", {
      name: "View Task",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name: "Start Task",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name:
        "in progress",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name:
        "Submit for Verification",
      exact: true,
    })
    .click();

  await page
    .getByLabel(
      "Completion evidence",
    )
    .fill(
      "The navigation was clear and the examples were helpful.",
    );

  await page
    .getByRole("button", {
      name:
        "Submit Evidence",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name:
        "pending verification",
      exact: true,
    })
    .click();

  await page
    .getByText(
      "pending verification",
      { exact: true },
    )
    .last()
    .waitFor();

  await go("/profile");

  await page
    .getByRole("heading", {
      name:
        "Transaction History",
    })
    .waitFor();

  assert.equal(
    await page
      .getByRole("button", {
        name:
          "Save Changes",
      })
      .isDisabled(),
    true,
  );

  await go("/ads");

  await page
    .getByRole("button", {
      name:
        "New Ad Plan",
    })
    .click();

  await page
    .getByRole("dialog")
    .waitFor();

  await page
    .getByText(
      "Audience planning notes",
      { exact: true },
    )
    .waitFor();

  await go("/admin-login");

  await page
    .getByPlaceholder(
      "Enter your admin PIN",
    )
    .fill("654321");

  await page
    .getByRole("button", {
      name:
        "Access Admin Panel",
    })
    .click();

  await page
    .getByRole("heading", {
      name:
        "Admin Dashboard",
    })
    .waitFor();

  await page
    .getByRole("button", {
      name: "campaigns",
      exact: true,
    })
    .click();

  await page
    .getByRole("button", {
      name:
        "Approve — charge 500 credits",
    })
    .waitFor();

  await page.screenshot({
    path:
      "/tmp/pcgh-admin-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  for (const path of [
    "/",
    "/buy-credits",
    "/submit",
    "/links",
    "/tasks",
    "/profile",
    "/ads",
    "/admin",
  ]) {
    await go(path);

    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement
            .scrollWidth <=
          window.innerWidth + 1,
      ),
      `Horizontal overflow: ${path}`,
    );
  }

  await go("/buy-credits");

  await page.screenshot({
    path:
      "/tmp/pcgh-credits-mobile.png",
    fullPage: true,
  });

  assert.deepEqual(
    errors,
    [],
  );

  console.log(
    "PASS: all eight pages, campaign submission, " +
      "task evidence flow, profile save state, " +
      "admin access, and mobile overflow checks " +
      "(mocked transport).",
  );

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
