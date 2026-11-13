# P8 - Best Use of MongoDB Atlas (MLH)

Researched 13 Nov 2026, web only. Prize: M5Stack IoT Kit per member. Landing: https://mlh.link/mongodb (not fetched; prize text came from the brief).

## 1. What the sponsor wants

Brief: build a hack using MongoDB Atlas. No published rubric found. The prize is entered by almost every team, so a plain "we stored data in Atlas" will not stand out.

What lights a judge up (inferred from MongoDB's current marketing and docs, not a rubric):
- Atlas Vector Search with a real retrieval job (RAG, semantic search), ideally with Voyage AI embeddings. Atlas now has "automated embedding": an `autoEmbed` index type where Atlas calls Voyage models for you on insert and query. Source: https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/models.md
- Hybrid use: Atlas Search (text) + Vector Search in one aggregation.
- Change streams driving live UI updates.
- Time series collections for sensor or event data (good fit with the M5Stack prize theme).
- MongoDB MCP server so the coding agent inspects collections and writes queries.
- Flexible documents that fit the domain (nested JSON from an LLM, varying shapes), explained in one sentence in the demo.

How MLH judges partner prizes: sponsor-side judges pick one team from Devpost submissions. Opt in on Devpost, state the Atlas features used. (General practice; unconfirmed for DurHack.)

## 2. Tech as of Nov 2026

Free tier: "Atlas Free" (formerly M0). Source: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- 0.5 GB storage (data + indexes), 500 connections, 100 ops/sec, 10 GB in and out per rolling 7 days.
- One free cluster per project. MongoDB 8.0. 3-node replica set (change streams work). Change stream filters on database names allow only strings/regex.
- Paused after 30 days with zero connections.
- No network peering or private endpoints, no Performance Advisor, no dedicated search nodes.
- No credit card needed to create a free cluster (per the brief).

Student credit: $50 Atlas credit and free certification via the GitHub Student Developer Pack. Source: https://mongodb.com/students
- Claim: sign in at mongodb.com/students with GitHub, generate the promo code, apply it to an Atlas organization (Billing, Credits). One use per code.
- Needs a valid credit card or PayPal on the Atlas account to redeem.
- Code expires if not applied within 90 days; generate it only when ready.
- Eligibility: enrolled in a degree/diploma programme, school email or documents, own GitHub account, 13+. GitHub and MongoDB emails do not need to match (page); forum reports say a mismatch gave some students a 50% voucher instead (https://www.mongodb.com/community/forums/t/github-student-pack-50-atlas-credit-shows-coupon-is-either-applied-before-start-date-or-after-end-date/338622 and related threads; unconfirmed).
- The MLH "$50 credit" in the brief appears to be this same student offer. If you are not in the Pack, you do not need it: the free cluster is enough.
- Do not bother with the credit unless you need a paid tier. Adding a card also raises the Voyage rate limits (below).

Automated embedding limits (same models page):
- Voyage models: voyage-4-lite, voyage-4, voyage-4-large, voyage-code-4, voyage-code-3.
- One-time 200M free tokens per model per organisation.
- Free cluster WITHOUT a payment method: query embedding limited to 3 requests/min and 2,000 tokens/min. That will break a live demo. Fix: add a payment method (rate limit then 2,000 RPM), or embed queries yourself with the Voyage API.
- Prepopulate the collection before creating the index (the first build is not rate limited).

Sign-up steps: atlas sign-up (Google/GitHub/email) -> create org and project -> Create Free cluster (pick a region near you, for example London or Ireland on AWS if offered) -> Database Access: add a user with password -> Network Access: add your IP or 0.0.0.0/0 for the hackathon -> Connect, copy the SRV string. About 5 to 8 minutes; cluster ready in 1 to 3 minutes. (Steps from general Atlas flow; the quickstart page was not fetched, so UI labels are unconfirmed.)

Hello world.
Python:
```python
from pymongo import MongoClient
c = MongoClient("mongodb+srv://USER:PASS@CLUSTER.mongodb.net/?retryWrites=true&w=majority")
c.demo.hello.insert_one({"hi": "durhack"})
print(c.demo.hello.find_one())
```
Node:
```js
import { MongoClient } from "mongodb";
const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
await c.db("demo").collection("hello").insertOne({ hi: "durhack" });
console.log(await c.db("demo").collection("hello").findOne());
await c.close();
```

Gotchas: IP allowlist (venue Wi-Fi changes IP; use 0.0.0.0/0 for the event, delete after); special characters in the password must be URL-encoded; 100 ops/sec cap throttles bulk loads (use `insert_many` batches); 0.5 GB cap including indexes; vector index builds are async (wait for status READY); only 3 search/vector indexes on free (third-party figure, unconfirmed).

## 3. Showcase pattern (under 2 hours)

Vector-search RAG plus change-stream live feed, on any app's documents.

Vector index (Node, own embeddings, 1024 dims for a voyage model; set dims to your model):
```js
await col.createSearchIndex({
  name: "vec",
  type: "vectorSearch",
  definition: { fields: [
    { type: "vector", path: "embedding", numDimensions: 1024, similarity: "cosine" },
    { type: "filter", path: "topic" } ] }
});
```
Query (syntax from MongoDB docs example, confirmed shape; fetched via https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/):
```js
col.aggregate([
  { $vectorSearch: { index: "vec", path: "embedding", queryVector: qvec,
      numCandidates: 150, limit: 5, filter: { topic: "x" } } },
  { $project: { text: 1, score: { $meta: "vectorSearchScore" } } }
]).toArray();
```
With automated embedding you define an `autoEmbed` field instead and pass query text; the exact JSON was not in the pages I could read, so copy it from https://mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/ rather than from memory.

Change stream for live UI (Node, push to the frontend over SSE or websocket):
```js
const cs = col.watch([{ $match: { operationType: "insert" } }]);
cs.on("change", ch => broadcast(ch.fullDocument));
```
Add a time series collection for sensor data if the idea has any: `db.createCollection("readings", { timeseries: { timeField: "ts", metaField: "device" } })`.
Demo: ask a question, show retrieved chunks with scores, insert a doc in another window and watch it appear live. Connect the MongoDB MCP server to your coding agent so it can inspect and index.

## 4. Past winners

I found no Devpost project that won an MLH "Best Use of MongoDB Atlas" in 2025-2026 via search (Devpost pages for UB Hacking, SwampHacks, Hack the Change returned 403). MongoDB is a standard prize at many MLH events (for example Hacklytics 2025 listed it per a search result), and winners are not indexed.
What exists:
- MongoDB's own hackathon winners post (non-MLH): https://mongodb.com/blog/post/hackathon-winners-announced
- MongoDB AI Hackathon on Devpost with a "Best Use of Atlas Vector Search" prize (date unconfirmed): https://events.mongodb.com/mongodbaihackathondetails
Action for a human: open Devpost galleries of recent MLH events and filter by "MongoDB Atlas" winner badge.

## 5. Both database prizes?

Recommendation: prioritise Tiger Data (P5). It is a newer partner with fewer entrants, a specific measurable angle, and one winner. Add Mongo only if it has a real job:
- Honest split: Tiger holds events/metrics/analytics (and optionally vectors); Mongo holds flexible documents (LLM outputs, user content, chat history) and vector RAG. A judge accepts this if the demo explains in one line why each exists.
- Forced split: duplicate storage "to qualify". Judges see through it, and Tiger prizes at some events require Tiger as the project's database.
- Cheapest credible version: Mongo as the document and RAG store (vector search + change streams), Tiger as the telemetry and analytics store, with a clear diagram. Extra cost about 1.5 to 2 hours.
- If the team has only about 3 free hours for databases, spend them on Tiger and use plain Atlas free tier with a simple vector search only if the app needs it.

## 6. Hours

- Qualify (cluster, store data, opt in): 30 to 60 min.
- Compete (vector RAG, change stream live UI, time series, MCP, clear write-up): 3 to 4 h.
- Risks: crowded prize; Voyage automated-embedding rate limit of 3 RPM without a payment method; free cluster 100 ops/sec; student credit claim glitches; IP allowlist on venue Wi-Fi.

## 7. Scores (1-5)

| Axis | Score | Note |
| --- | --- | --- |
| Fit for any idea | 5 | Any app can store docs |
| Win chance | 2 | Nearly everyone enters |
| Value | 3 | M5Stack IoT kit, retail about 40 to 50 GBP each (estimate), and useful for hardware teams |
| Effort (5 = cheap) | 4 | Free tier is quick; standing out costs more |

## 8. Do this tonight

1. Create an Atlas account, a free cluster, a DB user, and allow 0.0.0.0/0 for the event.
2. If anyone has the GitHub Student Pack, claim the $50 code at mongodb.com/students but only apply it if you need a card on file for higher Voyage limits.
3. Run the hello world in the stack the team picks; save the URI in the shared secrets, not git.
4. Create a vector index on a tiny test collection and run one `$vectorSearch`.
5. Decide with the owner: Mongo only as a sideline, or the honest Tiger + Mongo split.
6. Ask the MongoDB sponsor table at kickoff for the exact judging criteria.
