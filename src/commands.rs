// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use indexmap::IndexMap;
use serde_json::Value as JsonValue;
use sqlx::{
    migrate::Migrator,
    query::Query,
    sqlite::{SqliteArguments, SqliteRow},
    Column, Row, Sqlite,
};
use tauri::{command, AppHandle, Runtime, State};

use crate::{DbInstances, DbPool, DbTransactions, Error, LastInsertId, Migrations};

#[command]
pub(crate) async fn load<R: Runtime>(
    app: AppHandle<R>,
    db_instances: State<'_, DbInstances>,
    migrations: State<'_, Migrations>,
    db: String,
) -> Result<String, crate::Error> {
    let pool = DbPool::connect(&db, &app).await?;

    if let Some(migrations) = migrations.0.lock().await.remove(&db) {
        let migrator = Migrator::new(migrations).await?;
        pool.migrate(&migrator).await?;
    }

    db_instances.0.write().await.insert(db.clone(), pool);

    Ok(db)
}

/// Allows the database connection(s) to be closed; if no database
/// name is passed in then _all_ database connection pools will be
/// shut down.
#[command]
pub(crate) async fn close(
    db_instances: State<'_, DbInstances>,
    db: Option<String>,
) -> Result<bool, crate::Error> {
    let instances = db_instances.0.read().await;

    let pools = if let Some(db) = db {
        vec![db]
    } else {
        instances.keys().cloned().collect()
    };

    for pool in pools {
        let db = instances.get(&pool).ok_or(Error::DatabaseNotLoaded(pool))?;
        db.close().await;
    }

    Ok(true)
}

/// Execute a command against the database
#[command]
pub(crate) async fn execute(
    db_instances: State<'_, DbInstances>,
    db: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<(u64, LastInsertId), crate::Error> {
    let instances = db_instances.0.read().await;

    let db = instances.get(&db).ok_or(Error::DatabaseNotLoaded(db))?;
    db.execute(query, values).await
}

#[command]
pub(crate) async fn select(
    db_instances: State<'_, DbInstances>,
    db: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<IndexMap<String, JsonValue>>, crate::Error> {
    let instances = db_instances.0.read().await;

    let db = instances.get(&db).ok_or(Error::DatabaseNotLoaded(db))?;
    db.select(query, values).await
}

#[command]
pub async fn sql_transaction_begin(
    db_transactions: State<'_, DbTransactions>,
    db_instances: State<'_, DbInstances>,
    db: String,
) -> Result<usize, Error> {
    let instances = db_instances.0.read().await;
    let db = instances.get(&db).ok_or(Error::DatabaseNotLoaded(db))?;

    let pool = match db {
        DbPool::Sqlite(pool) => pool,
        //_ => panic!("Unexpected non-SQLite backend"),
    };

    // Open transaction
    let transaction = pool.begin().await?;

    // Store transaction in state
    let mut state = db_transactions.0.lock().await;
    let available_index = state.iter().position(|t| t.is_none());
    match available_index {
        Some(i) => {
            state[i] = Some(transaction);
            Ok(i)
        }
        None => {
            state.push(Some(transaction));
            Ok(state.len() - 1)
        }
    }
}

#[command]
pub async fn sql_transaction_execute(
    db_transactions: State<'_, DbTransactions>,
    transaction_instance_id: usize,
    query: String,
    values: Vec<JsonValue>,
) -> Result<(u64, i64), Error> {
    let mut state = db_transactions.0.lock().await;
    let transaction = state
        .get_mut(transaction_instance_id)
        .expect("Invalid database transaction ID")
        .as_mut() // Take reference to transaction rather than moving out of the Vec
        .expect("Database transaction ID used after closed");

    let query = prepare_query(&query, values);
    let result = query.execute(&mut **transaction).await?;
    Ok((result.rows_affected(), result.last_insert_rowid()))
}

#[command]
pub async fn sql_transaction_select(
    db_transactions: State<'_, DbTransactions>,
    transaction_instance_id: usize,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<IndexMap<String, JsonValue>>, Error> {
    let mut state = db_transactions.0.lock().await;
    let transaction = state
        .get_mut(transaction_instance_id)
        .expect("Invalid database transaction ID")
        .as_mut() // Take reference to transaction rather than moving out of the Vec
        .expect("Database transaction ID used after closed");

    let query = prepare_query(&query, values);
    let rows = query.fetch_all(&mut **transaction).await?;
    rows_to_vec(rows)
}

#[command]
pub async fn sql_transaction_rollback(
    db_transactions: State<'_, DbTransactions>,
    transaction_instance_id: usize,
) -> Result<(), Error> {
    let mut state = db_transactions.0.lock().await;

    let transaction = state
        .get_mut(transaction_instance_id)
        .expect("Invalid database transaction ID")
        .take() // Remove from Vec
        .expect("Database transaction ID used after closed");

    transaction.rollback().await?;
    Ok(())
}

#[command]
pub async fn sql_transaction_commit(
    db_transactions: State<'_, DbTransactions>,
    transaction_instance_id: usize,
) -> Result<(), Error> {
    let mut state = db_transactions.0.lock().await;

    let transaction = state
        .get_mut(transaction_instance_id)
        .expect("Invalid database transaction ID")
        .take() // Remove from Vec
        .expect("Database transaction ID used after closed");

    transaction.commit().await?;
    Ok(())
}

fn prepare_query<'a, 'b: 'a>(
    query: &'b str,
    values: Vec<JsonValue>,
) -> Query<'b, Sqlite, SqliteArguments<'a>> {
    // Copied from tauri_plugin_sql/src/commands.rs
    // Copyright 2019-2023 Tauri Programme within The Commons Conservancy
    // Licensed under MIT/Apache 2.0

    let mut query = sqlx::query(query);
    for value in values {
        if value.is_null() {
            query = query.bind(None::<JsonValue>);
        } else if value.is_string() {
            query = query.bind(value.as_str().unwrap().to_owned())
        } else if let Some(number) = value.as_number() {
            query = query.bind(number.as_f64().unwrap_or_default())
        } else {
            query = query.bind(value);
        }
    }
    query
}

fn rows_to_vec(rows: Vec<SqliteRow>) -> Result<Vec<IndexMap<String, JsonValue>>, Error> {
    // Copied from tauri_plugin_sql/src/commands.rs
    // Copyright 2019-2023 Tauri Programme within The Commons Conservancy
    // Licensed under MIT/Apache 2.0

    let mut values = Vec::new();
    for row in rows {
        let mut value = IndexMap::default();
        for (i, column) in row.columns().iter().enumerate() {
            let v = row.try_get_raw(i)?;

            let v = crate::decode::sqlite::to_json(v)?;

            value.insert(column.name().to_string(), v);
        }

        values.push(value);
    }
    Ok(values)
}
