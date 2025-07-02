import type {
  DrizzleConfig,
  ExtractTablesWithRelations,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from "drizzle-orm";
import {
  createTableRelationsHelpers,
  entityKind,
  extractTablesRelationalConfig,
} from "drizzle-orm";
import { BatchItem, BatchResponse } from "drizzle-orm/batch";
import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
} from "drizzle-orm/sqlite-core";
import { DatabaseExecutor, QueryResult } from "tauri-plugin-sqlite";
import { TauriSQLiteSession } from "./session";

export class TauriSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>
> extends BaseSQLiteDatabase<"async", QueryResult, TSchema> {
  static override readonly [entityKind]: string = "SqliteRemoteDatabase";

  /** @internal */
  declare readonly session: TauriSQLiteSession<
    TSchema,
    ExtractTablesWithRelations<TSchema>
  >;

  async batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    _batch: T
  ): Promise<BatchResponse<T>> {
    // return this.session.batch(batch) as Promise<BatchResponse<T>>;
    throw new Error("not supported yet");
  }
}

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  client: DatabaseExecutor,
  config?: DrizzleConfig<TSchema>
): TauriSQLiteDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  client: DatabaseExecutor,
  // batchCallback?: AsyncBatchRemoteCallback,
  config?: DrizzleConfig<TSchema>
): TauriSQLiteDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  client: DatabaseExecutor,
  // batchCallback?: AsyncBatchRemoteCallback | DrizzleConfig<TSchema>,
  config?: DrizzleConfig<TSchema>
): TauriSQLiteDatabase<TSchema> {
  const dialect = new SQLiteAsyncDialect({ casing: config?.casing });
  let logger;
  let cache;
  let _config: DrizzleConfig<TSchema> = {};

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (_config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      _config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: _config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const session = new TauriSQLiteSession(client, dialect, schema, {
    logger,
    cache,
  });
  const db = new TauriSQLiteDatabase(
    "async",
    dialect,
    session,
    schema
  ) as TauriSQLiteDatabase<TSchema>;
  //   (<any>db).$cache = cache;
  //   if ((<any>db).$cache) {
  //     (<any>db).$cache["invalidate"] = cache?.onMutate;
  //   }
  return db;
}
