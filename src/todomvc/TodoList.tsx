import { CtxAsync as Ctx, useQuery } from "@vlcn.io/react";
import Quill, { Delta as DeltaType, DeltaStatic } from "quill";
import "quill/dist/quill.snow.css";
import React from "react";
import ReactQuill from "react-quill";
import { newId } from "./id";
import { PositionSource } from "./position_source";

const Delta: typeof DeltaType = Quill.import("delta");

type Char = {
  position: string;
  char: string;
  bold: string;
};

/**
 * Convert delta.ops into an array of modified DeltaOperations
 * having the form { index: first char index, ...DeltaOperation},
 * leaving out ops that do nothing.
 */
function getRelevantDeltaOperations(delta: DeltaStatic): {
  index: number;
  insert?: string | object;
  delete?: number;
  attributes?: Record<string, any>;
  retain?: number;
}[] {
  if (delta.ops === undefined) return [];
  const relevantOps = [];
  let index = 0;
  for (const op of delta.ops) {
    if (op.retain === undefined || op.attributes) {
      relevantOps.push({ index, ...op });
    }
    // Adjust index for the next op.
    if (op.insert !== undefined) {
      if (typeof op.insert === "string") index += op.insert.length;
      else index += 1; // Embed
    } else if (op.retain !== undefined) index += op.retain;
    // Deletes don't add to the index because we'll do the
    // next operation after them, hence the text will already
    // be shifted left.
  }
  return relevantOps;
}

export default function TodoList({
  ctx,
  posSource,
}: {
  ctx: Ctx | null;
  posSource: PositionSource | null;
}) {
  const db = ctx?.db;

  // if db is null, spinner to indicate loading
  if (db == null || ctx == null || posSource == null) {
    // do some better fb like newsfeed loading indicators
    return <div>loading...</div>;
  }

  // TODO: indexes on format?
  // TODO: can we use the internal LWW field instead of our own Lamport?
  const textAnn: Char[] = useQuery<Char>(
    ctx,
    "SELECT position, char, " +
      "(SELECT format_value FROM format WHERE format.startPos <= text.position AND " +
      "text.position < format.endPos AND format.format_key = 'bold'" +
      "ORDER BY format.lamport DESC LIMIT 1) bold " +
      "FROM text ORDER BY position"
  ).data;
  const lamport =
    useQuery<{ lamport: number }>(
      ctx,
      "SELECT lamport FROM format ORDER BY lamport DESC LIMIT 1"
    ).data[0]?.lamport ?? 0;

  function onChange(_: string, delta: DeltaStatic, source: string) {
    // TODO: changes that remove formatting
    // using the "remove formatting" button, or by toggling
    // a link off, instead get emitted with source "api".
    if (source !== "user") return;

    // TODO: if multiple changes are dispatched at once (e.g. paste-during-highlight),
    // positions might behave weirdly because textAnn is not updated immediately.

    console.log("onChange");
    for (const op of getRelevantDeltaOperations(delta)) {
      console.log("op", op);
      // Insertion
      if (op.insert) {
        if (typeof op.insert === "string") {
          const newPositions: string[] = [];
          let before =
            op.index === 0 ? undefined : textAnn[op.index - 1].position;
          const after =
            op.index === textAnn.length
              ? undefined
              : textAnn[op.index].position;
          for (let i = 0; i < op.insert.length; i++) {
            const newPos = posSource!.createBetween(before, after);
            newPositions.push(newPos);
            before = newPos;
          }

          // TODO: bulk insert
          for (let i = 0; i < op.insert.length; i++) {
            db!.exec("INSERT INTO text VALUES (?, ?)", [
              newPositions[i],
              op.insert.charAt(i),
            ]);
          }
        } else {
          throw new Error("Embeds not supported");
        }
      }
      // Deletion
      else if (op.delete) {
        const positions = textAnn
          .slice(op.index, op.index + op.delete)
          .map((charAnn) => charAnn.position);
        // TODO: bulk delete
        for (const pos of positions) {
          db!.exec("DELETE FROM text WHERE position = ?", [pos]);
        }
      }
      // Formatting
      // TODO: if this is just a new char receiving the existing format,
      // we can skip this. Else will be inefficient.
      else if (op.attributes && op.retain) {
        const startPos = textAnn[op.index].position;
        const endPos =
          op.index + op.retain === textAnn.length
            ? posSource!.LAST
            : textAnn[op.index + op.retain].position;
        for (const [attr, value] of Object.entries(op.attributes)) {
          // Store as a formatting span in format.
          db!.exec("INSERT INTO format VALUES (?, ?, ?, ?, ?, ?)", [
            newId(db!.siteid.replaceAll("-", "")),
            attr,
            value == null ? "" : `${value}`,
            startPos,
            endPos,
            lamport + 1,
          ]);
        }
      }
    }
  }

  const quillState = new Delta({
    ops: textAnn.map((charAnn) => ({
      insert: charAnn.char,
      attributes: charAnn.bold === "true" ? { bold: true } : {},
    })),
  });
  console.log("state", quillState.ops);

  return (
    <ReactQuill
      theme="snow"
      value={quillState}
      formats={["bold"]}
      modules={{ toolbar: ["bold"] }}
      onChange={onChange}
    />
  );
}
