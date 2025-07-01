// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

const COMMANDS: &[&str] = &[
    "load",
    "execute",
    "select",
    "close",
    "sql_transaction_begin",
    "sql_transaction_execute",
    "sql_transaction_select",
    "sql_transaction_rollback",
    "sql_transaction_commit",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .global_api_script_path("./api-iife.js")
        .build();
}
