# Event Schema Status QA Briefs

Static browser-local MVP for Event structured data status QA.

## Public offer

Paste Event JSON-LD, visible event notes, status/date notes, venue/online notes, ticket/offer notes, performer/organizer notes, page type, and owner notes to get a copyable event schema status QA brief before launch or cleanup.

## Constraints

- no crawl
- no page fetch
- no event platform API
- no Rich Results Test
- no Search Console
- no backend or external database
- no ticketing, legal, compliance, eligibility, ranking, indexing, event operations, or attendee-support advice

## Conversion path

The landing page includes pricing hypothesis, local purchase-intent capture, a public-safe GitHub issue handoff, and copyable request details.

## SEO asset

- [Event structured data checklist](https://ert93333-ops.github.io/event-schema-status-qa-briefs/event-structured-data-checklist.html)
- [Public launch checklist Gist](https://gist.github.com/ert93333-ops/9a640e345c2a9e8dd3ba45ea75f4fb84)

## Marketing test URLs

- Landing: `https://ert93333-ops.github.io/event-schema-status-qa-briefs/?utm_source=github&utm_medium=repo&utm_campaign=event_schema_status_qa_launch`
- Checklist: `https://ert93333-ops.github.io/event-schema-status-qa-briefs/event-structured-data-checklist.html?utm_source=github&utm_medium=repo&utm_campaign=event_structured_data_checklist`

## Smoke test

From the Hermes playbook root:

```bash
npm run workflow:event-schema-status-qa
```
