// Legacy timer verification cannot award credits under the new campaign economy.
Deno.serve(
  (req: Request) =>
    new Response(
      req.method === "OPTIONS"
        ? null
        : JSON.stringify({
            error:
              "Use campaign claims and submit evidence for admin verification.",
          }),
      {
        status: req.method === "OPTIONS" ? 204 : 410,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Authorization, Content-Type, apikey, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      },
    ),
);
