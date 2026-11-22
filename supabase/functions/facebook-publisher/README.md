# Facebook Page publishing pilot

This rollout supports one operator-configured Facebook Page and an explicit allowlist of PCGH user IDs. Posts are organic. A PCGH user previews the content, confirms the named destination Page, and presses Publish now. The function uses Meta's official Page feed and photos endpoints. Text posts can attach a link. Photo posts use a public HTTPS image URL and include the destination link in the caption. Status checks never reissue a publication. When delivery is uncertain, verify it on the Page before making a new attempt.

## Page-owner permission and Meta review

Ask a Page owner or an authorized Page administrator to approve the following before enabling the pilot.

> May PCGH publish organic promotional posts to the Facebook Page you designate, only after an authorized PCGH user reviews the exact post and confirms publication? PCGH will use the Page token solely to publish confirmed Page posts. The app will never initiate ad spend. You can revoke access by removing the token and disabling publishing for your PCGH account.

The Page operator must have the Page task or access that permits creating content. Configure the Meta developer app, request `pages_manage_posts` and its required `pages_read_engagement` access for the Page publishing use case, and obtain a Page access token authorized for that Page. `pages_show_list` is applicable if using the account Page-listing flow to obtain the token. This pilot has no Page discovery or customer OAuth onboarding. For people outside the Meta app's roles, complete the applicable Meta App Review, access-level approval, and any business verification Meta requires before enabling publishing. Use an owned test Page during development.

## Supabase setup

Apply the publication-attempts migration and deploy the `facebook-publisher` Edge Function. Enter the following in Supabase Edge Function secrets.

- `FACEBOOK_PUBLISH_ORIGIN` is the exact PCGH browser origin, with scheme and no trailing slash.
- `FACEBOOK_PAGE_ID` is the authorized numeric Page ID.
- `FACEBOOK_PAGE_NAME` is the Page name shown to publishers.
- `FACEBOOK_PUBLISHER_IDS` contains the comma-separated PCGH auth user IDs authorized by the Page operator.
- `FACEBOOK_GRAPH_VERSION` is a Graph API version supported by the Meta app.
- `FACEBOOK_PAGE_ACCESS_TOKEN` is the Page token. Enter it through the secret manager. Keep it out of the browser, repository and chat.

The built-in Supabase service role is used inside the Edge Function to validate the PCGH session and record publication attempts. Browser accounts have no table access. Removing the Page token disables publication. There is no scheduling, personal-profile publication, paid promotion or live Meta verification in this implementation.
