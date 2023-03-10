import React, { useState } from "react";

import { SQLite3 } from "@vlcn.io/wa-crsqlite";

import { Ctx } from "./openDB.js";
import { PositionSource } from "./position_source.js";
import SelectList from "./SelectList.js";
import TodoList from "./TodoList.js";
import todoLists from "./todoLists.js";

export default function App({ sqlite }: { sqlite: SQLite3 }) {
  const [openOrConnect, setOpenOrConnect] = useState(true);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [posSource, setPosSource] = useState<PositionSource | null>(null);

  const onDbOpened = (ctx: Ctx) => {
    setCtx(ctx);
    setPosSource(new PositionSource());
    setOpenOrConnect(false);
    todoLists.add({
      dbid: ctx.dbid,
      name: "New List",
      accessed: Date.now() / 1000,
    });
    window.location.hash = ctx.dbid;
  };

  return (
    <div>
      {openOrConnect ? (
        <SelectList
          currentCtx={ctx}
          sqlite={sqlite}
          onCancel={() => {
            setOpenOrConnect(false);
          }}
          onDbOpened={onDbOpened}
        />
      ) : (
        <TodoList ctx={ctx} posSource={posSource} />
      )}
    </div>
  );
}
