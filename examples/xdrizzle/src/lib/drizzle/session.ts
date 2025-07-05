import type {
  Logger,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from "drizzle-orm";
import {
  entityKind,
  fillPlaceholders,
  NoopLogger,
  type Query,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Cache, NoopCache } from "drizzle-orm/cache/core";
import { WithCacheConfig } from "drizzle-orm/cache/core/types";
import type {
  PreparedQueryConfig as PreparedQueryConfigBase,
  SelectedFieldsOrdered,
  SQLiteAsyncDialect,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";
import {
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import { DatabaseExecutor, QueryResult } from "tauri-plugin-sqlite";

export interface TauriSQLiteSessionOptions {
  logger?: Logger;
  cache?: Cache;
}

export type PreparedQueryConfig = Omit<
  PreparedQueryConfigBase,
  "statement" | "run"
>;

export class TauriSQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteSession<"async", QueryResult, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "TauriSQLiteSession";

  private logger: Logger;
  private cache: Cache;

  constructor(
    private client: DatabaseExecutor,
    readonly dialect: SQLiteAsyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    // private batchCLient?: AsyncBatchRemoteCallback,
    options: TauriSQLiteSessionOptions = {}
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }

  prepareQuery<T extends Omit<PreparedQueryConfig, "run">>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
    queryMetadata?: {
      type: "select" | "update" | "delete" | "insert";
      tables: string[];
    },
    cacheConfig?: WithCacheConfig
  ): TauriSQLitePreparedQuery<T> {
    return new TauriSQLitePreparedQuery(
      this.client,
      query,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }

  async batch<T extends BatchItem<"sqlite">[] | readonly BatchItem<"sqlite">[]>(
    _queries: T
  ) {
    throw new Error("batch is not supported in TauriSQLiteSession");
  }

  override async transaction<T>(
    transaction: (
      tx: TauriSQLiteTransaction<TFullSchema, TSchema>
    ) => Promise<T>,
    _config?: SQLiteTransactionConfig
  ): Promise<T> {
    const nativeTransaction = await this.client.begainTransaction();
    const childSession = new TauriSQLiteSession<TFullSchema, TSchema>(
      nativeTransaction,
      this.dialect,
      this.schema,
      {
        logger: this.logger,
        cache: this.cache,
      }
    );
    const tx = new TauriSQLiteTransaction(
      "async",
      this.dialect,
      childSession,
      this.schema
    );
    try {
      const result = await transaction(tx);
      await nativeTransaction.commit();
      return result;
    } catch (err) {
      await nativeTransaction.rollback();
      throw err;
    }
  }
}

export class TauriSQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteTransaction<"async", QueryResult, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "TauriSQLiteTransaction";

  override async transaction<T>(
    _transaction: (
      tx: TauriSQLiteTransaction<TFullSchema, TSchema>
    ) => Promise<T>
  ): Promise<T> {
    throw new Error("child transaction is not supported");
  }
}

export class TauriSQLitePreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig
> extends SQLitePreparedQuery<{
  type: "async";
  run: QueryResult;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  static override readonly [entityKind]: string = "TauriSQLitePreparedQuery";

  private method: SQLiteExecuteMethod;

  constructor(
    private client: DatabaseExecutor,
    query: Query,
    private logger: Logger,
    cache: Cache,
    queryMetadata:
      | {
          type: "select" | "update" | "delete" | "insert";
          tables: string[];
        }
      | undefined,
    cacheConfig: WithCacheConfig | undefined,
    private fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private _isResponseInArrayMode: boolean,
    /** @internal */ public customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown
    ) => unknown
  ) {
    super("async", executeMethod, query, cache, queryMetadata, cacheConfig);
    this.customResultMapper = customResultMapper;
    this.method = executeMethod;
  }

  override getQuery(): Query & { method: SQLiteExecuteMethod } {
    return { ...this.query, method: this.method };
  }

  async run(placeholderValues?: Record<string, unknown>): Promise<QueryResult> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.client.execute(this.query.sql, params);
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T["all"]> {
    const { query, logger, client } = this;

    const params = fillPlaceholders(query.params, placeholderValues ?? {});
    logger.logQuery(query.sql, params);
    return client.select(this.query.sql, params);
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T["get"]> {
    const { query, logger, client } = this;

    const params = fillPlaceholders(query.params, placeholderValues ?? {});
    logger.logQuery(query.sql, params);

    return client.select(this.query.sql, params);
  }

  async values<T extends any[] = unknown[]>(
    placeholderValues?: Record<string, unknown>
  ): Promise<T[]> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.client.select(this.query.sql, params);
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode;
  }
}
