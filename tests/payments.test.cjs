const {
  test,
  after,
} = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
const originalFetch = global.fetch;

let authUser = {
  id: "verified-user",
  email: "verified@test.invalid",
};

let orders = [];
let settlements = [];
let providerPayload;

const sb = {
  auth: {
    getUser: async (token) => ({
      data: {
        user:
          token === "valid-token"
            ? authUser
            : null,
      },
      error: null,
    }),
  },

  from: (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            is_active: true,
          },
          error: null,
        }),
      }),
    }),

    insert: async (order) => {
      orders.push(order);
      return {
        error: null,
      };
    },
  }),

  rpc: async (name, args) => {
    settlements.push({
      name,
      args,
    });

    return {
      data: {
        ok: true,
      },
      error: null,
    };
  },
};

Module._load = function (name, ...rest) {
  if (name === "@supabase/supabase-js") {
    return {
      createClient: () => sb,
    };
  }

  return originalLoad.call(
    this,
    name,
    ...rest,
  );
};

const init = require(
  "../api/payments/flutterwave/init.js",
);

const webhook = require(
  "../api/payments/flutterwave/webhook.js",
);

Module._load = originalLoad;

Object.assign(process.env, {
  SUPABASE_URL: "https://test.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-only",
  FLW_SECRET_KEY: "test-only",
  APP_URL: "https://app.test.invalid",
  FLW_WEBHOOK_SECRET_HASH: "test-signature",
});

function response() {
  return {
    code: null,
    body: null,

    status(code) {
      this.code = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

after(() => {
  global.fetch = originalFetch;
});

test(
  "checkout requires a verified session and ignores supplied identity/pricing",
  async () => {
    let res = response();

    await init(
      {
        method: "POST",
        headers: {},
        body: {
          plan: "starter_pack",
        },
      },
      res,
    );

    assert.equal(res.code, 401);

    global.fetch = async (url, opts) => {
      providerPayload = JSON.parse(opts.body);

      return {
        ok: true,
        json: async () => ({
          data: {
            link:
              "https://checkout.test.invalid",
          },
        }),
      };
    };

    res = response();

    await init(
      {
        method: "POST",
        headers: {
          authorization:
            "Bearer valid-token",
        },
        body: {
          plan: "starter_pack",
          user_id: "attacker",
          email:
            "attacker@test.invalid",
          credits: 999999,
          amount: 1,
        },
      },
      res,
    );

    assert.equal(res.code, 200);
    assert.equal(providerPayload.amount, 500);

    assert.equal(
      providerPayload.customer.email,
      authUser.email,
    );

    assert.equal(
      orders.at(-1).user_id,
      authUser.id,
    );

    assert.equal(
      orders.at(-1).credits,
      500,
    );

    for (const amount of [
      99,
      100001,
      100.5,
      "NaN",
    ]) {
      res = response();

      await init(
        {
          method: "POST",
          headers: {
            authorization:
              "Bearer valid-token",
          },
          body: {
            plan: "custom",
            credits: amount,
          },
        },
        res,
      );

      assert.equal(res.code, 400);
    }

    res = response();

    await init(
      {
        method: "POST",
        headers: {
          authorization:
            "Bearer valid-token",
        },
        body: {
          plan: "custom",
          credits: 300,
        },
      },
      res,
    );

    assert.equal(res.code, 200);
    assert.equal(providerPayload.amount, 300);
  },
);

test(
  "webhook rejects bad signatures and settles only provider-verified values",
  async () => {
    let res = response();

    await webhook(
      {
        method: "POST",
        headers: {
          "verif-hash": "bad",
        },
        body: {},
      },
      res,
    );

    assert.equal(res.code, 401);
    assert.equal(settlements.length, 0);

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          status: "successful",
          tx_ref: "trusted-order",
          amount: 300,
          currency: "NGN",
        },
      }),
    });

    res = response();

    await webhook(
      {
        method: "POST",
        headers: {
          "verif-hash":
            "test-signature",
        },
        body: {
          data: {
            id: 123,
            tx_ref: "forged-order",
            amount: 999999,
            meta: {
              credits: 999999,
            },
          },
        },
      },
      res,
    );

    assert.equal(res.code, 200);

    assert.deepEqual(
      settlements.at(-1),
      {
        name: "settle_credit_order",
        args: {
          p_reference: "trusted-order",
          p_provider_id: "123",
          p_amount: 300,
          p_currency: "NGN",
        },
      },
    );

    global.fetch = async () => ({
      ok: false,
    });

    res = response();

    await webhook(
      {
        method: "POST",
        headers: {
          "verif-hash":
            "test-signature",
        },
        body: {
          data: {
            id: 124,
          },
        },
      },
      res,
    );

    assert.equal(res.code, 500);
    assert.equal(settlements.length, 1);
  },
);
