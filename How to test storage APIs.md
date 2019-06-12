# How to test sync storage?

We wish to test that:

1. on upgrading a version, uses don't lose their data irrespective of they had sync or local storage.
2. swapping from sync to local or vc-vs works as expected.

This involves several steps.

vPREV - last published stable version
vNEXT - version we wish to push
test data - custom exported data for test that we use.

## Upgrade version test

### Local upgrade test

1. Install local extension.vPREV. Import test data.
2. Copy paste new source code into the folder and reload the extension to upgrade to vNEXT.
3. Ensure settings remain saved. Ensure no errors in Console.

Repeat for both sync and local storage.

### Online upgrade test

This requires the developer's dashboard.

1. Install unlisted vPREV extension. Import test data.
2. Push an upgrade to vNEXT, wait 60minutes.
3. Ensure settings are safe and no errors.

Repeat for both sync and local storage.

## Sync storage test

Can only be tested online

### Online storage test

This requires the developer's dashboard.

1. Publish vNEXT unlisted.
2. Make changes to settings and make sure they're visible in the other PC.
3. swap b/w local and sync and verify intended effects.
