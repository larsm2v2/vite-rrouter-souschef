# Documentation index

Start here. Three documents describe the system as it is today; everything else is reference or history.

## Current (read these first)

| Document                                     | Use it to                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)           | Understand how the client, server, cleaner and database fit together: layers, API, data model, auth, flows, security, decisions, known gaps |
| [design-system.md](design-system.md)         | Build UI that matches: principles, color, type, spacing, layering, breakpoints, components, interaction and accessibility rules             |
| [build-and-release.md](build-and-release.md) | Set up a machine, run the quality gates, understand CI, and ship a release the same way every time                                          |
| [DEPLOY_CHEATSHEET.md](DEPLOY_CHEATSHEET.md) | Copy the exact deploy, verify and rollback commands                                                                                         |

## Active planning and reporting

| Document                                                            | What it is                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [mobile-recipe-ux-roadmap.md](mobile-recipe-ux-roadmap.md)          | Research-backed UX principles, decisions D1 to D10, what was built, what is not done |
| [frontend-audit-report.md](frontend-audit-report.md) (also `.html`) | Frontend audit findings and the verification numbers                                 |

## Reference that is still broadly accurate

These describe features that still exist, but they predate the current docs, and some contain project-specific identifiers. Check the code before relying on details.

| Document                                                                 | Topic                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| [async-ocr-implementation.md](async-ocr-implementation.md)               | Async OCR with Pub/Sub                             |
| [phase2-deployment-guide.md](phase2-deployment-guide.md)                 | Deploying the async OCR infrastructure             |
| [phase2-implementation-summary.md](phase2-implementation-summary.md)     | What phase 2 delivered                             |
| [client-side-pkce-implementation.md](client-side-pkce-implementation.md) | Client-side PKCE implementation notes              |
| [pkce-architecture-decision.md](pkce-architecture-decision.md)           | Why PKCE moved to the client (the decision record) |
| [oauth-troubleshooting.md](oauth-troubleshooting.md)                     | Google "access blocked" troubleshooting            |

## Superseded (replaced by the current docs)

| Document                                                           | Replaced by                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [system-architecture-overview.md](system-architecture-overview.md) | [architecture.md](architecture.md)                                                         |
| [API.md](API.md)                                                   | [architecture.md](architecture.md) section 2.5                                             |
| [DEPLOYMENT.md](DEPLOYMENT.md)                                     | [build-and-release.md](build-and-release.md), [DEPLOY_CHEATSHEET.md](DEPLOY_CHEATSHEET.md) |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                   | [build-and-release.md](build-and-release.md)                                               |

## Historical (plans and reports for work that is done or dropped)

Kept for context. They describe earlier states of the code and may be wrong today.

[api-gateway-architecture-plan.md](api-gateway-architecture-plan.md), [AUTH_MIGRATION.md](AUTH_MIGRATION.md), [cleanup-plan.md](cleanup-plan.md), [DEBUG_LOGIN.md](DEBUG_LOGIN.md), [file-mapping.md](file-mapping.md), [function-flow.md](function-flow.md), [oauth-routes-cleanup-plan.md](oauth-routes-cleanup-plan.md), [ProfileRefactoringPlan.md](ProfileRefactoringPlan.md), [profile-displayname-tasks.md](profile-displayname-tasks.md), [ROUTES_DEBUG_GUIDE.md](ROUTES_DEBUG_GUIDE.md), [server-architecture-evaluation.md](server-architecture-evaluation.md), [test-migration-plan.md](test-migration-plan.md), [types-entities-compare-report.md](types-entities-compare-report.md), [types-rewire-plan.md](types-rewire-plan.md), `PKCE_IMPLEMENTATION_GUIDE.json`, `tools-summary.json`.

---

## Rules for these docs

1. **No real values.** Never write project ids, service URLs, client ids, hostnames, database names, tokens or secrets. Name the variable and say where its value lives. Some older files above predate this rule and still contain identifiers; do not copy from them.
2. **Verify before you write.** State only what you have read in the code or run. Mark anything unfinished or unsafe in the "known gaps" sections instead of hiding it.
3. **One owner per fact.** Put a fact in the document that owns it (API in architecture.md, UI rules in design-system.md, commands in build-and-release.md or the cheatsheet) and link to it from the others.
4. **Update with the change.** A change that adds a route, token, component, environment variable or gate updates the matching document in the same commit.
5. **Retire, don't pile up.** When a document is replaced, mark it superseded here and at its top.
