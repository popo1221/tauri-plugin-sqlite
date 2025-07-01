## Default Permission

### Default Permissions

This permission set configures what kind of
database operations are available from the sql plugin.

### Granted Permissions

All reading related operations are enabled.
Also allows to load or close a connection.

#### This default permission set includes the following:

- `allow-close`
- `allow-load`
- `allow-select`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`sqlite:allow-close`

</td>
<td>

Enables the close command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-close`

</td>
<td>

Denies the close command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-execute`

</td>
<td>

Enables the execute command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-execute`

</td>
<td>

Denies the execute command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-load`

</td>
<td>

Enables the load command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-load`

</td>
<td>

Denies the load command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-select`

</td>
<td>

Enables the select command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-select`

</td>
<td>

Denies the select command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-sql-transaction-begin`

</td>
<td>

Enables the sql_transaction_begin command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-sql-transaction-begin`

</td>
<td>

Denies the sql_transaction_begin command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-sql-transaction-commit`

</td>
<td>

Enables the sql_transaction_commit command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-sql-transaction-commit`

</td>
<td>

Denies the sql_transaction_commit command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-sql-transaction-execute`

</td>
<td>

Enables the sql_transaction_execute command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-sql-transaction-execute`

</td>
<td>

Denies the sql_transaction_execute command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-sql-transaction-rollback`

</td>
<td>

Enables the sql_transaction_rollback command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-sql-transaction-rollback`

</td>
<td>

Denies the sql_transaction_rollback command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:allow-sql-transaction-select`

</td>
<td>

Enables the sql_transaction_select command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`sqlite:deny-sql-transaction-select`

</td>
<td>

Denies the sql_transaction_select command without any pre-configured scope.

</td>
</tr>
</table>
