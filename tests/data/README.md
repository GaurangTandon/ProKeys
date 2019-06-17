# Test data

This data can be exported into a v3.4.3+ extension to enable it for testing.
It features several changes to default data, and the aim is that after upgrading from one version to another, this data must be retained as is.

## Testing sync data

1. Before changing to sync in the second PC, you have to wait like five minutes to ensure the data from the first PC has reached Google servers.

### Things to test in sync

1. Sync updates in one page are reflected on another (after browser relaunch).
2. Too quick sync (set sync on in one pc and quickly set it in another) results in neat error message with no data loss.
3. Upgrade from previous public version to next version does not cause any error.
4. 