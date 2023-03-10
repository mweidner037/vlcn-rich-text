import { CtxAsync as Ctx, useQuery } from "@vlcn.io/react";
import Quill, { Delta as DeltaType, DeltaStatic } from "quill";
import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { PositionSource } from "./position_source";

const Delta: typeof DeltaType = Quill.import("delta");

type Char = {
  position: string;
  char: string;
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

  const textAnn: Char[] = useQuery<Char>(
    ctx,
    "SELECT * FROM text ORDER BY position"
  ).data;
  const text = textAnn.map((charAnn) => charAnn.char).join("");

  function onChange(_: string, delta: DeltaStatic, source: string) {
    // TODO: changes that remove formatting
    // using the "remove formatting" button, or by toggling
    // a link off, instead get emitted with source "api".
    if (source !== "user") return;

    for (const op of getRelevantDeltaOperations(delta)) {
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
      // Formatting TODO
      // else if (op.attributes && op.retain) {
      //   for (let i = 0; i < op.retain; i++) {
      //     // For max CRDT-ness, we should implement each attr value as an
      //     // LWWRegister. Instead, out of laziness, we will use
      //     // RTDB's built-in conflict resolution for set()s and
      //     // remove()s, which does essentially the same thing.
      //     for (const [attr, value] of Object.entries(op.attributes)) {
      //       const attrRef = ref(
      //         db,
      //         "text/" + keys[op.index + i] + "/attrs/" + attr
      //       );
      //       if (value === null) {
      //         // Delete attr.
      //         remove(attrRef);
      //       } else {
      //         set(attrRef, value);
      //       }
      //     }
      //   }
      // }
    }
  }

  const quillState = new Delta().insert(text);

  return (
    <ReactQuill
      theme="snow"
      value={quillState}
      formats={[]}
      onChange={onChange}
    />
  );
}
