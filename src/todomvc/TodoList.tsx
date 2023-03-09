import { CtxAsync as Ctx, useQuery } from "@vlcn.io/react";
import React from "react";

type Char = {
  id: string;
  char: string;
  position: string;
};

export default function TodoList({ ctx }: { ctx: Ctx | null }) {
  const db = ctx?.db;
  function append(prevPos: string) {
    // TODO
    const pos = `${prevPos}z`;
    db!.exec(`INSERT INTO text (char, position) VALUES ('a', '${pos}')`);
  }

  // if db is null, spinner to indicate loading
  if (db == null || ctx == null) {
    // do some better fb like newsfeed loading indicators
    return <div>loading...</div>;
  }

  const textArr: Char[] = useQuery<Char>(
    ctx,
    "SELECT * FROM text ORDER BY position"
  ).data;
  const text = textArr.map((char) => char.char).join("");

  return (
    <>
      <p onClick={() => append(textArr.at(-1)?.position ?? "z")}>
        Your text: "{text}"
      </p>
    </>
  );
}
