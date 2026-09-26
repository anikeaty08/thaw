import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { graphql } from "ponder";

// Ponder >=0.9 serves nothing unless an API entry exists. apps/web, apps/bot and the keeper all
// POST to /graphql, so that's the one route we expose (plus Ponder's built-in /health, /ready).
const app = new Hono();

app.use("/graphql", graphql({ db, schema }));

export default app;
