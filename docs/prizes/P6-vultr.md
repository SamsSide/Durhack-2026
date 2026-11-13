# P6 - Best Use of Vultr (MLH, "Assorted prizes")

Researched 2026-11-13 with WebSearch/WebFetch only. Items marked unconfirmed could not be verified.

## What qualifies

- MLH lists the prize as "Best Use of Vultr: Assorted Prizes" with the brief you were given. No judging criteria are published: https://www.mlh.com/events/qwer-hacks-21/prizes (a past MLH event page; page gives no criteria or judges).
- MLH's Vultr partner page has no prize rules either: https://www.mlh.com/partners/vultr
- The only safe reading: the project must visibly run on Vultr and say so in the Devpost write-up and demo. Ask the Vultr rep or MLH coach on site what they judge (unconfirmed).
- Past prize example: QWER Hacks listed "Portable Screens" for Best Use of Vultr (same MLH prizes page). Prize items vary per event.

## Free credit offer

| Item | Finding | Source |
| --- | --- | --- |
| Amount | $100 credit for MLH hackers | https://www.mlh.com/partners/vultr |
| How | Register at mlh.link/vultr-discover for a promo code (students: school as Company, "Student" as Job Title), verify the email, then create the account at mlh.link/vultr-signup, then enter the code under Billing > Gift Code | MLH partner page |
| Gift Code tab missing | Sign out and back in via mlh.link/vultr-giftcode so the tab appears | MLH partner page (via search summary) |
| Credit card / PayPal | MLH page says "no credit card required" when claiming via MLH coach gift code. Unconfirmed whether Vultr still asks for a card to deploy. Third-party sites claim a card or PayPal is needed for generic promos; not trusted | MLH page, search summary |
| UK debit card | Unconfirmed. Have a card or PayPal ready as a fallback | none |
| Expiry | Not stated on the MLH page. Unconfirmed | MLH page |
| Verification wait | Not stated. Email verification only. Possible manual review on new accounts (unconfirmed). Sign up tonight, not at 10am | none |
| Limits | One registration per person. Terms of Service and AUP apply | MLH page |

Ignore third-party "$250 / $300" promo codes (FLY300VULTR etc.). Unofficial, unverified.

## Cheapest credible use

1. Docker app on one small Vultr Cloud Compute instance (Docker Marketplace app, one-click). Cheapest. Roughly $5 to $12 a month for a small plan (plan prices unconfirmed; check the portal). The $100 covers it many times over.
2. Vultr Serverless Inference (managed open models). Billing is now usage-based per model, with a price sheet in the console: https://docs.vultr.com/vultr-cloud-inference . Older pages said $10/month plan with 5M or 50M tokens (the two Vultr pages disagree), so verify in the console. Docs say it is compatible with OpenAI libraries (swap base URL and use a Vultr key) and that earlier only Chat Completions was supported. Base URL not confirmed; copy it from the Chat endpoint article under https://docs.vultr.com/products/serverless/inference/management/usage
3. Cloud GPU for your own open-weights model (vLLM or Ollama): most impressive, costs the most per hour, GPU availability and quotas may need approval (unconfirmed). Delete it after the demo.
4. Object Storage, Managed Databases, Kubernetes: nice extras, each adds setup time. Only add if the app needs them.

## What would impress

- An open-weights model served through Vultr (Serverless Inference or a GPU box) as the app's core feature, not an add-on.
- Backend live on a public Vultr URL with HTTPS, not localhost.
- One extra Vultr product used for a real reason (Object Storage for uploads, managed Postgres).
- Multi-region is flashy but costs time; only if there is a real latency story.
- A one-slide architecture diagram that names the Vultr products.

## Get a Docker app live with HTTPS in under 30 minutes

Confirmed pieces: vultr-cli create syntax is `vultr-cli instance create --region <id> --plan <id> --os <id> --host <name>`; marketplace apps are found with `vultr-cli apps list` and passed by image id (the Docker app's exact value is unconfirmed). Docs: https://docs.vultr.com/one-click-docker , https://docs.vultr.com/reference/vultr-cli/apps , https://github.com/vultr/vultr-cli/blob/master/README.md

Steps (portal route is the safest; CLI is an optional speed-up):

1. Create the account and apply the gift code (5 min, do tonight).
2. Deploy New > Cloud Compute > pick a nearby region (London or Amsterdam) > Marketplace Apps > Docker > cheapest plan > add your SSH key.
3. CLI alternative: `export VULTR_API_KEY=...` (create under Account > API, add your IP to the allow list), then `vultr-cli regions list`, `vultr-cli plans list`, `vultr-cli apps list`, then `vultr-cli instance create ...` with the app image flag. Confirm flags with `--help`.
4. SSH in. Clone the repo (or `docker compose` from a registry image). Run `docker compose up -d`.
5. HTTPS: point a domain A record at the instance IP and run Caddy in the compose file (`caddy reverse-proxy --from yourdomain --to app:3000`). Caddy gets the certificate automatically. No domain? Use `<ip>.sslip.io` as the hostname.
6. Open ports 80 and 443 (firewall group in the portal, and `ufw allow 80,443/tcp` on the box).
7. Terraform exists (Vultr provider) but is slower to set up than the portal for a one-off. Skip it.

## Gotchas

- New accounts may be limited on instance counts or GPU (unconfirmed). Test a deploy tonight.
- API key access control blocks calls from unlisted IPs (including hackathon wifi).
- Docker app creates a `docker` user; you may need `sudo` or root for compose.
- Ports 80/443 closed by default in some images; open them.
- Costs run while an instance exists. Destroy it after judging.
- Wifi at events can block outbound SSH; have a phone hotspot.

## Past winners (2025 to 2026)

Not found. Search turned up only the QWER Hacks prize listing. Vultr-run events (LabLab "Agent Rush" 3-8 Nov 2026, HackXelerator 2025) publish their own category winners (https://blogs.vultr.com/HackXelerator-2025 , https://blogs.vultr.com/hack-this-fall-developer-ai), not "Best Use of Vultr" at MLH events. Check Devpost galleries of past MLH events manually (unconfirmed).

## Hours: qualify vs compete

- Qualify: about 1 hour (account, gift code, Docker deploy, Caddy HTTPS, mention in README and Devpost).
- Compete: 3 to 5 hours total if the model inference runs on Vultr and a second product is used and shown in the demo.

## Scores (1 to 5; effort 5 = cheap)

| Criterion | Score | Why |
| --- | --- | --- |
| Fit for any idea | 5 | Any backend can be hosted there |
| Win chance | 2 | Criteria unknown, "assorted" prizes, many teams will just host |
| Value | 2 | Assorted swag, low or unknown value |
| Effort (5 = cheap) | 4 | One VM is quick; GPU or Kubernetes lowers this |

## Do this tonight

- [ ] Register at mlh.link/vultr-discover, verify email (check spam).
- [ ] Create the account at mlh.link/vultr-signup, apply the gift code, note the expiry and whether a card was asked.
- [ ] Add an SSH key and an API key (allow-list your IP or all IPv4 for the weekend).
- [ ] Deploy a test Docker instance, run hello world behind Caddy, then destroy it.
- [ ] Open Serverless Inference in the console, copy the base URL and price sheet, test one chat call with the OpenAI SDK.
- [ ] Ask the Vultr rep tomorrow what judges look for.
