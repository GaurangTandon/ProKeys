# General tips for debugging

These golden rules help you narrow down the code subset in which your issue is.  
We'll be looking for the set of consecutive lines inside one file that cause a issue. We'll call them "culprits".

## General tipcs

1. Add breakpoints in Chrome Source or `console.dir(error);` to all try-catch blocks. And note the error that is occurring.

## When you're uncertain in which file the culprit is present

1. First comment **one-by-one** the independent files.
2. If culprit is NOT found, delink the FIRST dependent file, _from the bottom_.
3. Then comment the SECOND dependent file. Don't remove the comments from the previous file, since it is dependent on the file you just commented.
4. Repeat the loop 3 with the next dependent file, up until you've finished all the JS files.

If you've found in which file the culprit lies, head to the next section. If not, the force is not with you! Sigh!

## After you're certain in which file the culprit is present

1. Be sure to add back the EventTarget.addEventListener prototype modification that I had commented in v3.1.0 over integration issues with QuillJS. It could be possible that the code is attaching duplicate event listeners to the same elm which are clashing.
