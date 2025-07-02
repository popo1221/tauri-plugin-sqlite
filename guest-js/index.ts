// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

import { invoke } from '@tauri-apps/api/core'

export interface DatabaseExecutor {
  execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  begainTransaction(): Promise<Transaction>;
}

export interface QueryResult {
  /** The number of rows affected by the query. */
  rowsAffected: number
  /**
   * The last inserted `id`.
   *
   * This value is not set for Postgres databases. If the
   * last inserted id is required on Postgres, the `select` function
   * must be used, with a `RETURNING` clause
   * (`INSERT INTO todos (title) VALUES ($1) RETURNING id`).
   */
  lastInsertId?: number
}

/**
 * **Database**
 *
 * The `Database` class serves as the primary interface for
 * communicating with the rust side of the sql plugin.
 */
export class Database implements DatabaseExecutor {
  path: string
  constructor(path: string) {
    this.path = path
  }

  /**
   * **load**
   *
   * A static initializer which connects to the underlying database and
   * returns a `Database` instance once a connection to the database is established.
   *
   * # Sqlite
   *
   * The path is relative to `tauri::path::BaseDirectory::App` and must start with `sqlite:`.
   *
   * @example
   * ```ts
   * const db = await Database.load("sqlite:test.db");
   * ```
   */
  static async load(path: string): Promise<Database> {
    const _path = await invoke<string>('plugin:sqlite|load', {
      db: path
    })

    return new Database(_path)
  }

  /**
   * **get**
   *
   * A static initializer which synchronously returns an instance of
   * the Database class while deferring the actual database connection
   * until the first invocation or selection on the database.
   *
   * # Sqlite
   *
   * The path is relative to `tauri::path::BaseDirectory::App` and must start with `sqlite:`.
   *
   * @example
   * ```ts
   * const db = Database.get("sqlite:test.db");
   * ```
   */
  static get(path: string): Database {
    return new Database(path)
  }

  /**
   * **execute**
   *
   * Passes a SQL expression to the database for execution.
   *
   * @example
   * ```ts
   * // for sqlite & postgres
   * // INSERT example
   * const result = await db.execute(
   *    "INSERT into todos (id, title, status) VALUES ($1, $2, $3)",
   *    [ todos.id, todos.title, todos.status ]
   * );
   * // UPDATE example
   * const result = await db.execute(
   *    "UPDATE todos SET title = $1, completed = $2 WHERE id = $3",
   *    [ todos.title, todos.status, todos.id ]
   * );
   *
   * // for mysql
   * // INSERT example
   * const result = await db.execute(
   *    "INSERT into todos (id, title, status) VALUES (?, ?, ?)",
   *    [ todos.id, todos.title, todos.status ]
   * );
   * // UPDATE example
   * const result = await db.execute(
   *    "UPDATE todos SET title = ?, completed = ? WHERE id = ?",
   *    [ todos.title, todos.status, todos.id ]
   * );
   * ```
   */
  async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
    const [rowsAffected, lastInsertId] = await invoke<[number, number]>(
      'plugin:sqlite|execute',
      {
        db: this.path,
        query,
        values: bindValues ?? []
      }
    )
    return {
      lastInsertId,
      rowsAffected
    }
  }

  /**
   * **select**
   *
   * Passes in a SELECT query to the database for execution.
   *
   * @example
   * ```ts
   * // for sqlite & postgres
   * const result = await db.select(
   *    "SELECT * from todos WHERE id = $1", [ id ]
   * );
   *
   * // for mysql
   * const result = await db.select(
   *    "SELECT * from todos WHERE id = ?", [ id ]
   * );
   * ```
   */
  async select<T>(query: string, bindValues?: unknown[]): Promise<T> {
    const result = await invoke<T>('plugin:sqlite|select', {
      db: this.path,
      query,
      values: bindValues ?? []
    })

    return result
  }

  async begainTransaction(): Promise<Transaction> {
    const transactionInstanceId = await beginTransaction(this)
    return new Transaction(transactionInstanceId)
  }

  /**
   * **close**
   *
   * Closes the database connection pool.
   *
   * @example
   * ```ts
   * const success = await db.close()
   * ```
   * @param db - Optionally state the name of a database if you are managing more than one. Otherwise, all database pools will be in scope.
   */
  async close(db?: string): Promise<boolean> {
    const success = await invoke<boolean>('plugin:sqlite|close', {
      db
    })
    return success
  }
}

export class Transaction implements DatabaseExecutor {
  id: number
  constructor(id: number) {
    this.id = id
  }
  begainTransaction(): Promise<Transaction> {
    throw new Error('Method not implemented.');
  }

  async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
    return executeTransaction(this.id, query, bindValues)
  }

  async select<T>(query: string, bindValues?: unknown[]): Promise<T> {
    return selectTransaction(this.id, query, bindValues)
  }

  async rollback(): Promise<void> {
    return rollbackTransaction(this.id)
  }

  async commit(): Promise<void> {
    return commitTransaction(this.id)
  }
}

export async function beginTransaction(db: Database) {
  const result = await invoke<number>('plugin:sqlite|sql_transaction_begin', {
    db: db.path
  })
  return result
}

export async function executeTransaction(
  transactionInstanceId: number,
  query: string,
  bindValues?: unknown[]
): Promise<QueryResult> {
  const [rowsAffected, lastInsertId] = await invoke<[number, number]>(
    'plugin:sqlite|sql_transaction_execute',
    {
      transactionInstanceId,
      query,
      values: bindValues ?? []
    }
  )
  return {
    lastInsertId,
    rowsAffected
  }
}

export async function selectTransaction<T>(
  transactionInstanceId: number,
  query: string,
  bindValues?: unknown[]
): Promise<T> {
  const result = await invoke<T>('plugin:sqlite|sql_transaction_select', {
    transactionInstanceId,
    query,
    values: bindValues ?? []
  })
  return result
}

export async function rollbackTransaction(
  transactionInstanceId: number
): Promise<void> {
  const result = await invoke<void>('plugin:sqlite|sql_transaction_rollback', {
    transactionInstanceId
  })
  return result
}

export async function commitTransaction(
  transactionInstanceId: number
): Promise<void> {
  const result = await invoke<void>('plugin:sqlite|sql_transaction_commit', {
    transactionInstanceId
  })
  return result
}
