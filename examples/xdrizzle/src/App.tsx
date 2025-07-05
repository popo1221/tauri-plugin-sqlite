import { useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import {
  beginTransaction,
  commitTransaction,
  Database,
  executeTransaction,
  rollbackTransaction,
  selectTransaction,
} from "tauri-plugin-sqlite-plus";
import { dbPromise } from "./lib/db/database";
import { postsTable, usersTable } from "./lib/db/schema";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const dbRef = useRef<Database>();

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));

    await testTransaction3();
  }

  async function testTransaction3() {
    const db = await dbPromise;
    db.transaction(async (tx) => {
      const users0 = await tx.select().from(usersTable);
      console.log("users0", users0);
      await tx
        .insert(usersTable)
        .values({
          name: "user001" + users0.length,
          age: 12,
          email: "user001@gmail.com" + users0.length,
        });
      const users1 = await tx.select().from(usersTable);
      console.log("users1", users1);

      const posts0 = await tx.select().from(postsTable);
      console.log("posts0", posts0);
      await tx
        .insert(postsTable)
        .values({
          title: "postTitle0001",
          content: "postContent0001",
          userId: 1,
        });
      const posts1 = await tx.select().from(postsTable);
      console.log("posts1", posts1);
      throw new Error('human error')
    });
  }

  async function testTransaction2() {
    const db = await dbPromise;
    const users0 = await db.select().from(usersTable);
    console.log("users0", users0);
    await db
      .insert(usersTable)
      .values({
        name: "user001" + users0.length,
        age: 12,
        email: "user001@gmail.com" + users0.length,
      });
    const users1 = await db.select().from(usersTable);
    console.log("users1", users1);

    const posts0 = await db.select().from(postsTable);
    console.log("posts0", posts0);
    await db
      .insert(postsTable)
      .values({
        title: "postTitle0001",
        content: "postContent0001",
        userId: 1,
      });
    const posts1 = await db.select().from(postsTable);
    console.log("posts1", posts1);
  }

  async function testTransaction() {
    let transactionInstance = null;
    if (!dbRef.current) {
      dbRef.current = await Database.load("sqlite:xdrizzle.db");
    }
    try {
      transactionInstance = await beginTransaction(dbRef.current);
      console.log("start transaction", transactionInstance);
      const result = await executeTransaction(
        transactionInstance,
        "INSERT into users (id, name) VALUES ($1, $2)",
        [Date.now(), "user001"]
      );
      console.log("result: ", result);

      const allUsers = await selectTransaction(
        transactionInstance,
        "select * from users"
      );
      console.log("allUsers: ", allUsers);

      throw Error("human error");

      const result2 = await executeTransaction(
        transactionInstance,
        "INSERT into posts (id, name) VALUES ($1, $2)",
        [Date.now(), "posts002"]
      );
      console.log("result2: ", result2);

      const allPosts = await selectTransaction(
        transactionInstance,
        "select * from posts"
      );
      console.log("allPosts: ", allPosts);

      await commitTransaction(transactionInstance);

      console.log("commitTransaction: ", transactionInstance);
    } catch (err) {
      console.log("err", err);
      if (null != transactionInstance) {
        await rollbackTransaction(transactionInstance);
      }
    }

    const allUsers = await dbRef.current.select("select * from users");
    console.log("allUsers2: ", allUsers);

    const allPosts = await dbRef.current.select("select * from posts");
    console.log("allPosts2: ", allPosts);
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
