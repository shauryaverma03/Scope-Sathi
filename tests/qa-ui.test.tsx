import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Review,
  RequestForm,
  Modal,
  ErrorContext,
  dialogError,
} from "../src/App";
import { createProject, approveBaseline } from "../server/domain";
import { analyse } from "../server/ai";
import type { ChangeRequest } from "../shared/model";

test("new dialogs do not inherit old pricing errors, but new identical failures remain visible", () => {
  const old = {
    message:
      "Paid rounds require a finite allowance and a separate client with accepted project access.",
    sequence: 5,
  };
  const html = renderToStaticMarkup(
    <ErrorContext.Provider value={old}>
      <Modal title="New request" subtitle="Test" close={() => {}} busy={false}>
        <p>Request form</p>
      </Modal>
    </ErrorContext.Provider>,
  );
  assert.doesNotMatch(html, /Paid rounds require/);
  assert.equal(dialogError(old, 5), "");
  assert.equal(dialogError({ ...old, sequence: 6 }, 5), old.message);
  assert.equal(dialogError({ message: "", sequence: 7 }, 5), "");
});

test("pending manual proposals expose edit controls only to reviewers", async () => {
  const owner = { uid: "owner", email: "owner@example.com", name: "Owner" };
  const p = createProject(owner, "Permission QA", "", "");
  approveBaseline(p, owner, "Customers must search products.", [
    {
      id: "REQ-001",
      text: "Customers must search products.",
      quote: "Customers must search products.",
    },
  ]);
  const text = "Please add product price sorting.";
  const request: ChangeRequest = {
    id: "qa-request",
    title: "Price sorting",
    source: "Synthetic client",
    text,
    analysis: await analyse(p, text, false, false),
    baselineVersion: 1,
    engine: "Manual review · no AI calls",
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: owner.email,
    category: "new_scope",
    roundId: "qa-round",
  };
  p.requests.push(request);
  p.rounds.push({
    id: "qa-round",
    name: "QA round",
    createdAt: request.createdAt,
    createdBy: owner.email,
  });
  const props = {
    p,
    request,
    busy: false,
    close: () => {},
    decide: () => {},
    reanalyse: () => {},
    save: () => {},
  };
  for (const canEdit of [false, true]) {
    const html = renderToStaticMarkup(
      <Review {...props} canReview={false} canEdit={canEdit} />,
    );
    assert.doesNotMatch(
      html,
      /Save proposal|Add finding|Reviewed request category/,
    );
    assert.match(html, /Manual review/);
  }
  assert.match(
    renderToStaticMarkup(<Review {...props} canReview canEdit />),
    /Save proposal/,
  );
});

test("configured AI request form also offers an explicit manual recovery path", () => {
  const p = createProject(
    { uid: "owner", email: "owner@example.com", name: "Owner" },
    "Recovery QA",
    "",
    "",
  );
  const html = renderToStaticMarkup(
    <RequestForm p={p} demo={false} busy={false} submit={() => {}} />,
  );
  assert.match(html, /Manual review — no AI call/);
  assert.match(html, /If Gemini is unavailable/);
});
