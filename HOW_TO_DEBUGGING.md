##My experiences based off debugging files

These golden rules help you narrow down the code subset in which your issue is.  
We'll be looking for the set of consecutive lines inside one file that cause a issue. We'll call them "culprits".

####When you're uncertain in which file the culprit is present
Suppose your `<head>` of html looks like:

```
<link href="../css/reset.css" rel="stylesheet">
<link href="../css/options.css" rel="stylesheet">
<link href="../css/editor.min.css" rel="stylesheet">

<script src="../js/pre.js"></script>             // A
<script src="../js/snippet_classes.js"></script> // B
<script src="../js/options.js"></script>        // C
<script src="../js/detector.js"></script>        // D
<script src="../js/editor.min.js"></script>   	 // E (independent)
<script src="../js/temp.js"></script>            // F (independent)
```
_(in order of decreasing dependency, each js file uses functions from previous file)_

You need to delink the files one by one and keep checking if the issue repeats.

// TODO: in case of jQuery, etc. library scripts linked

1. First comment **one-by-one** the independent files.
2. If culprit is NOT found, delink the FIRST dependent file, _from the bottom_.
3. Then comment the SECOND dependent file. Don't remove the comments from the previous file, since it is dependent on the file you just commented.
3. Repeat the loop 3 with the next dependent file, up until you've finished all the JS files.

If you've found in which file the culprit lies, head to the next section. If not, the force is not with you! Sigh!

####After you're certain in which file the culprit is present
